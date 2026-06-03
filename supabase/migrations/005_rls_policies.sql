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
