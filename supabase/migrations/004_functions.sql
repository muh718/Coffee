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
