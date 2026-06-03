-- =============================================
-- تحديث: أول مستخدم يسجل يصبح أدمن تلقائياً
-- =============================================

-- حذف الدالة القديمة وإنشاء واحدة جديدة
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  -- عد المستخدمين الحاليين
  SELECT COUNT(*) INTO user_count FROM public.users;

  -- أول مستخدم يصبح أدمن تلقائياً
  INSERT INTO public.users (id, email, name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'user' END,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- تحديث المستخدم الحالي (إن وُجد) ليصبح أدمن
UPDATE public.users SET role = 'admin'
WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1);
