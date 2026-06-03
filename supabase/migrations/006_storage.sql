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
