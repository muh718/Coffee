-- =============================================
-- 015: Family Roles and Safe Account Deletion
-- =============================================

-- 1. Add family_role column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS family_role VARCHAR(50) NOT NULL DEFAULT 'member';

-- 2. Update existing owners to be family_role = 'admin'
UPDATE public.users u
SET family_role = 'admin'
FROM public.families f
WHERE f.owner_id = u.id;

-- 3. Function to explicitly create a family for the current user (Update from 012 to set family_role)
CREATE OR REPLACE FUNCTION public.create_user_family()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_record RECORD;
    new_family_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;

    SELECT * INTO user_record FROM public.users WHERE id = current_user_id;

    IF user_record.family_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'أنت بالفعل ضمن عائلة');
    END IF;

    -- Create family
    new_family_id := gen_random_uuid();
    INSERT INTO public.families (id, name, owner_id, created_at)
    VALUES (new_family_id, 'عائلة ' || user_record.name, current_user_id, NOW());

    -- Update user
    UPDATE public.users 
    SET family_id = new_family_id,
        family_role = 'admin'
    WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true, 'family_id', new_family_id);
END;
$$;

-- 4. Function to leave a family (Update from 012 to transfer records and clear family_role)
CREATE OR REPLACE FUNCTION public.leave_family()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_record RECORD;
    family_record RECORD;
    next_owner_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;

    SELECT * INTO user_record FROM public.users WHERE id = current_user_id;

    IF user_record.family_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'أنت لست في عائلة');
    END IF;

    SELECT * INTO family_record FROM public.families WHERE id = user_record.family_id;

    -- If user is the owner, we need to transfer ownership
    IF family_record.owner_id = current_user_id THEN
        -- Find the oldest member who is not the current user
        SELECT id INTO next_owner_id 
        FROM public.users 
        WHERE family_id = user_record.family_id AND id != current_user_id 
        ORDER BY created_at ASC 
        LIMIT 1;

        IF next_owner_id IS NOT NULL THEN
            -- Transfer ownership
            UPDATE public.families SET owner_id = next_owner_id WHERE id = family_record.id;
            -- Make the new owner an admin
            UPDATE public.users SET family_role = 'admin' WHERE id = next_owner_id;
            
            -- Transfer user's records to the new owner
            UPDATE public.records SET created_by = next_owner_id WHERE created_by = current_user_id;
        ELSE
            -- If no next owner, and leaving family... wait, leaving family when you're the only one?
            -- That means the family will be empty. We should delete the family.
            -- But we also need to delete records because they would be orphaned.
            DELETE FROM public.records WHERE created_by = current_user_id;
            DELETE FROM public.families WHERE id = family_record.id;
        END IF;
    ELSE
        -- If not the owner, transfer their records to the current owner before leaving
        UPDATE public.records SET created_by = family_record.owner_id WHERE created_by = current_user_id;
    END IF;

    -- Remove user from family
    UPDATE public.users 
    SET family_id = NULL,
        family_role = 'member'
    WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Function for the owner to remove a member (Update from 012 to transfer records)
CREATE OR REPLACE FUNCTION public.remove_family_member(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_record RECORD;
    target_record RECORD;
    family_record RECORD;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;

    SELECT * INTO user_record FROM public.users WHERE id = current_user_id;
    SELECT * INTO target_record FROM public.users WHERE id = target_user_id;
    
    IF target_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
    END IF;

    IF user_record.family_id IS NULL OR user_record.family_id != target_record.family_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'المستخدم ليس في عائلتك');
    END IF;

    SELECT * INTO family_record FROM public.families WHERE id = user_record.family_id;

    IF family_record.owner_id != current_user_id AND user_record.family_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'فقط مسؤولو العائلة يمكنهم طرد الأعضاء');
    END IF;

    IF target_user_id = current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك طرد نفسك، استخدم ميزة الخروج من العائلة بدلاً من ذلك');
    END IF;

    -- Transfer records to the family owner before kicking
    UPDATE public.records SET created_by = family_record.owner_id WHERE created_by = target_user_id;

    -- Remove target from family
    UPDATE public.users 
    SET family_id = NULL,
        family_role = 'member'
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Function to prepare for account deletion
CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_record RECORD;
    family_record RECORD;
    next_owner_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;

    SELECT * INTO user_record FROM public.users WHERE id = current_user_id;

    -- If in a family, handle leaving logic first
    IF user_record.family_id IS NOT NULL THEN
        SELECT * INTO family_record FROM public.families WHERE id = user_record.family_id;

        -- If owner
        IF family_record.owner_id = current_user_id THEN
            SELECT id INTO next_owner_id 
            FROM public.users 
            WHERE family_id = user_record.family_id AND id != current_user_id 
            ORDER BY created_at ASC 
            LIMIT 1;

            IF next_owner_id IS NOT NULL THEN
                -- Transfer ownership & records
                UPDATE public.families SET owner_id = next_owner_id WHERE id = family_record.id;
                UPDATE public.users SET family_role = 'admin' WHERE id = next_owner_id;
                UPDATE public.records SET created_by = next_owner_id WHERE created_by = current_user_id;
            ELSE
                -- No other members, delete family and records
                DELETE FROM public.records WHERE created_by = current_user_id;
                DELETE FROM public.families WHERE id = family_record.id;
            END IF;
        ELSE
            -- Not owner, transfer records to owner
            UPDATE public.records SET created_by = family_record.owner_id WHERE created_by = current_user_id;
        END IF;

        -- Remove from family
        UPDATE public.users SET family_id = NULL, family_role = 'member' WHERE id = current_user_id;
    ELSE
        -- Not in a family, just delete any records they might have created independently
        DELETE FROM public.records WHERE created_by = current_user_id;
    END IF;

    -- Delete user record from public.users so auth.users can be deleted without constraint issues
    DELETE FROM public.users WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Function to permanently delete the user's auth account
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
    -- Delete from auth.users (requires SECURITY DEFINER to bypass auth schema protections)
    DELETE FROM auth.users WHERE id = auth.uid();
    SELECT jsonb_build_object('success', true);
$$;

-- 8. Function to change a member's family role
CREATE OR REPLACE FUNCTION public.change_family_role(target_user_id UUID, new_role VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_record RECORD;
    target_record RECORD;
    family_record RECORD;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
    END IF;

    IF new_role NOT IN ('admin', 'member') THEN
        RETURN jsonb_build_object('success', false, 'error', 'دور غير صالح');
    END IF;

    SELECT * INTO user_record FROM public.users WHERE id = current_user_id;
    SELECT * INTO target_record FROM public.users WHERE id = target_user_id;
    
    IF target_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
    END IF;

    IF user_record.family_id IS NULL OR user_record.family_id != target_record.family_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'المستخدم ليس في عائلتك');
    END IF;

    SELECT * INTO family_record FROM public.families WHERE id = user_record.family_id;

    -- Only the family owner can change roles
    IF family_record.owner_id != current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'فقط مؤسس العائلة يمكنه تغيير الصلاحيات');
    END IF;

    IF target_user_id = current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك تغيير صلاحيتك الخاصة بهذه الطريقة');
    END IF;

    -- Update role
    UPDATE public.users 
    SET family_role = new_role
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
