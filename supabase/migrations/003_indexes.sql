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
