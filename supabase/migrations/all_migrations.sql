-- ============================================
-- 001: Enable Required PostgreSQL Extensions
-- ============================================

-- Trigram-based fuzzy matching for duplicate detection & Arabic text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Levenshtein distance for secondary similarity checks
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Unaccent for normalized text search
CREATE EXTENSION IF NOT EXISTS unaccent;
-- ============================================
-- 002: Create Core Tables
-- ============================================

-- Create role enum
CREATE TYPE user_role AS ENUM ('admin', 'user');

-- ----------------------------------------
-- Users table (synced from auth.users)
-- ----------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Records table (document archives)
-- ----------------------------------------
CREATE TABLE public.records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    cover_image_url TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    name_search TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Images table (attached to records)
-- ----------------------------------------
CREATE TABLE public.images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    raw_ocr_text TEXT DEFAULT '',
    search_vector TSVECTOR,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Audit Logs table (security & tracking)
-- ----------------------------------------
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- ============================================
-- 003: Create Indexes for Performance
-- ============================================

-- Full-text search on images OCR content
CREATE INDEX idx_images_search_vector ON public.images USING GIN (search_vector);

-- Trigram index on raw OCR text for Arabic fuzzy search
CREATE INDEX idx_images_raw_ocr_trgm ON public.images USING GIN (raw_ocr_text gin_trgm_ops);

-- Trigram index on record names for duplicate detection
CREATE INDEX idx_records_name_trgm ON public.records USING GIN (name gin_trgm_ops);

-- Full-text search on record names
CREATE INDEX idx_records_name_search ON public.records USING GIN (name_search);

-- Audit logs lookup by user and time
CREATE INDEX idx_audit_logs_user_time ON public.audit_logs (user_id, performed_at DESC);

-- Audit logs lookup by action type
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

-- Images by record for gallery queries
CREATE INDEX idx_images_record_id ON public.images (record_id, uploaded_at DESC);

-- Records by creator
CREATE INDEX idx_records_created_by ON public.records (created_by);

-- Records ordered by creation date (for dashboard)
CREATE INDEX idx_records_created_at ON public.records (created_at DESC);
-- ============================================
-- 004: Database Functions & Triggers
-- ============================================

-- ----------------------------------------
-- Helper: Check if current user is admin
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------
-- Trigger: Sync new auth.users to public.users
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'user',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------
-- Trigger: Auto-update search_vector on images
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.update_image_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('simple', COALESCE(NEW.raw_ocr_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_image_search_vector
    BEFORE INSERT OR UPDATE OF raw_ocr_text ON public.images
    FOR EACH ROW EXECUTE FUNCTION public.update_image_search_vector();

-- ----------------------------------------
-- Trigger: Auto-update name_search on records
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.update_record_name_search()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name_search := to_tsvector('simple', COALESCE(NEW.name, ''));
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_record_name_search
    BEFORE INSERT OR UPDATE OF name ON public.records
    FOR EACH ROW EXECUTE FUNCTION public.update_record_name_search();

-- ----------------------------------------
-- Trigger: Bump record updated_at on image changes
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.update_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.records
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.record_id, OLD.record_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_update_record_on_image_change
    AFTER INSERT OR DELETE ON public.images
    FOR EACH ROW EXECUTE FUNCTION public.update_record_timestamp();

-- ----------------------------------------
-- Function: Find similar record names (fuzzy match)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_records(query_name TEXT)
RETURNS TABLE (
    record_id UUID,
    record_name VARCHAR,
    similarity_score REAL,
    is_exact_match BOOLEAN,
    is_highly_similar BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS record_id,
        r.name AS record_name,
        similarity(LOWER(r.name), LOWER(query_name)) AS similarity_score,
        (LOWER(TRIM(r.name)) = LOWER(TRIM(query_name))) AS is_exact_match,
        (similarity(LOWER(r.name), LOWER(query_name)) > 0.8) AS is_highly_similar
    FROM public.records r
    WHERE similarity(LOWER(r.name), LOWER(query_name)) > 0.3
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------
-- Function: Deep search across records and images
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.deep_search(search_query TEXT, result_limit INT DEFAULT 20, result_offset INT DEFAULT 0)
RETURNS TABLE (
    record_id UUID,
    record_name VARCHAR,
    cover_image_url TEXT,
    created_by UUID,
    creator_name VARCHAR,
    image_count BIGINT,
    created_at TIMESTAMPTZ,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH matched_records AS (
        -- Match by record name (tsvector)
        SELECT r.id, ts_rank(r.name_search, websearch_to_tsquery('simple', search_query)) * 2.0 AS rank
        FROM public.records r
        WHERE r.name_search @@ websearch_to_tsquery('simple', search_query)

        UNION

        -- Match by record name (trigram for fuzzy/Arabic)
        SELECT r.id, similarity(LOWER(r.name), LOWER(search_query)) AS rank
        FROM public.records r
        WHERE LOWER(r.name) % LOWER(search_query)

        UNION

        -- Match by image OCR text (tsvector)
        SELECT i.record_id, ts_rank(i.search_vector, websearch_to_tsquery('simple', search_query)) AS rank
        FROM public.images i
        WHERE i.search_vector @@ websearch_to_tsquery('simple', search_query)

        UNION

        -- Match by image OCR text (trigram for fuzzy/Arabic)
        SELECT i.record_id, similarity(LOWER(i.raw_ocr_text), LOWER(search_query)) * 0.5 AS rank
        FROM public.images i
        WHERE LOWER(i.raw_ocr_text) % LOWER(search_query)
    ),
    ranked AS (
        SELECT mr.id, MAX(mr.rank) AS max_rank
        FROM matched_records mr
        GROUP BY mr.id
    )
    SELECT
        r.id AS record_id,
        r.name AS record_name,
        r.cover_image_url,
        r.created_by,
        u.name AS creator_name,
        (SELECT COUNT(*) FROM public.images img WHERE img.record_id = r.id) AS image_count,
        r.created_at,
        rk.max_rank AS relevance
    FROM ranked rk
    JOIN public.records r ON r.id = rk.id
    LEFT JOIN public.users u ON u.id = r.created_by
    ORDER BY rk.max_rank DESC
    LIMIT result_limit
    OFFSET result_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
-- ============================================
-- 005: Row Level Security Policies
-- ============================================

-- ========== USERS TABLE ==========

-- All authenticated users can view all user profiles
CREATE POLICY "users_select_authenticated" ON public.users
    FOR SELECT TO authenticated
    USING (true);

-- Users can update their own profile (name, avatar)
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can update any user (including role changes)
CREATE POLICY "users_update_admin" ON public.users
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ========== RECORDS TABLE ==========

-- All authenticated users can view all records
CREATE POLICY "records_select_authenticated" ON public.records
    FOR SELECT TO authenticated
    USING (true);

-- All authenticated users can create records
CREATE POLICY "records_insert_authenticated" ON public.records
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Only admins can update records (rename)
CREATE POLICY "records_update_admin" ON public.records
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Only admins can delete records
CREATE POLICY "records_delete_admin" ON public.records
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ========== IMAGES TABLE ==========

-- All authenticated users can view all images
CREATE POLICY "images_select_authenticated" ON public.images
    FOR SELECT TO authenticated
    USING (true);

-- All authenticated users can upload images
CREATE POLICY "images_insert_authenticated" ON public.images
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);

-- Only admins can delete images
CREATE POLICY "images_delete_admin" ON public.images
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Only admins can update image metadata
CREATE POLICY "images_update_admin" ON public.images
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ========== AUDIT LOGS TABLE ==========

-- Only admins can view audit logs
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- Allow service role to insert audit logs (Edge Functions)
-- Note: service_role bypasses RLS, so this policy is for 
-- authenticated users to insert their own action logs
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
-- ============================================
-- 006: Storage Bucket & Policies
-- ============================================

-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    true,
    10485760, -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff']
)
ON CONFLICT (id) DO NOTHING;

-- ========== STORAGE POLICIES ==========

-- All authenticated users can view/download images
CREATE POLICY "documents_select_authenticated" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents');

-- Public read access for cover images
CREATE POLICY "documents_select_public" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'documents');

-- All authenticated users can upload images
CREATE POLICY "documents_insert_authenticated" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents');

-- All authenticated users can update their own uploads
CREATE POLICY "documents_update_authenticated" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Only admins can delete images from storage
CREATE POLICY "documents_delete_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents' AND EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    ));
