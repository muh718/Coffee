-- =============================================
-- 013: Fix infinite recursion in users RLS policy
-- =============================================

-- 1. Create a function to get the current user's family_id without triggering RLS on users
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT family_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "users_select_family" ON public.users;

-- 3. Create the new policy using the function
CREATE POLICY "users_select_family" ON public.users
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR 
        (family_id IS NOT NULL AND family_id = public.get_my_family_id())
    );
