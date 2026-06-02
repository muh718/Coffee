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
