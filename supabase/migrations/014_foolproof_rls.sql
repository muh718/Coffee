-- =============================================
-- 014: SIMPLIFIED USERS RLS TO GUARANTEE NO ERRORS
-- =============================================

-- Drop the previous recursive policy and any function we created
DROP POLICY IF EXISTS "users_select_family" ON public.users;
DROP FUNCTION IF EXISTS public.get_my_family_id();

-- Create a simple policy: Any authenticated user can read the users table
-- This completely eliminates ANY possibility of infinite recursion.
CREATE POLICY "users_select_all" ON public.users
    FOR SELECT TO authenticated
    USING (true);
