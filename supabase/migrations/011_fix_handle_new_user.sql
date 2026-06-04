-- =============================================
-- 011: Fix handle_new_user for Family System
-- =============================================

-- تعديل دالة handle_new_user لتجنب مشكلة Foreign Key constraint
-- الترتيب الصحيح:
-- 1. إنشاء المستخدم في جدول public.users (بدون عائلة)
-- 2. إنشاء العائلة في جدول public.families (مع تعيين المالك)
-- 3. تحديث المستخدم لربطه بالعائلة التي تم إنشاؤها

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_family_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- توليد ID جديد للعائلة
    new_family_id := uuid_generate_v4();

    -- 1. إنشاء المستخدم كأدمن ولكن بدون عائلة مؤقتاً لتجنب خطأ Foreign Key
    INSERT INTO public.users (id, email, name, role, avatar_url, family_id)
    VALUES (
        NEW.id,
        NEW.email,
        user_name,
        'admin',
        NEW.raw_user_meta_data->>'avatar_url',
        NULL
    );

    -- 2. إنشاء العائلة وتعيين المستخدم (الذي تم إنشاؤه للتو) كمالك
    INSERT INTO public.families (id, name, owner_id, created_at)
    VALUES (new_family_id, 'عائلة ' || user_name, NEW.id, NOW());

    -- 3. تحديث المستخدم لربطه بالعائلة الجديدة
    UPDATE public.users 
    SET family_id = new_family_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
