-- =============================================
-- 012: Manual Family Creation and Leave Logic
-- =============================================

-- 1. Restore handle_new_user to simple behavior (no auto-family)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role, avatar_url, family_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        ),
        'user',
        NEW.raw_user_meta_data->>'avatar_url',
        NULL
    );

    RETURN NEW;
END;
$$;

-- 2. Function to explicitly create a family for the current user
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
        role = 'admin'
    WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true, 'family_id', new_family_id);
END;
$$;

-- 3. Function to leave a family
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
            UPDATE public.users SET role = 'admin' WHERE id = next_owner_id;
        END IF;
    END IF;

    -- Remove user from family
    UPDATE public.users 
    SET family_id = NULL,
        role = 'user'
    WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Function for the owner to remove a member
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

    IF family_record.owner_id != current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'فقط مؤسس العائلة يمكنه طرد الأعضاء');
    END IF;

    IF target_user_id = current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك طرد نفسك، استخدم ميزة الخروج من العائلة بدلاً من ذلك');
    END IF;

    -- Remove target from family
    UPDATE public.users 
    SET family_id = NULL,
        role = 'user'
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
