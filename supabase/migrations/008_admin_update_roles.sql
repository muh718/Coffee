-- =============================================
-- إضافة صلاحية تحديث الأدوار للأدمن
-- =============================================

-- السماح للأدمن بتحديث أدوار المستخدمين الآخرين
DO $$
BEGIN
  -- حذف السياسة القديمة إن وجدت
  DROP POLICY IF EXISTS "Admins can update user roles" ON public.users;
  
  -- إنشاء سياسة جديدة تسمح للأدمن بتحديث جميع المستخدمين
  CREATE POLICY "Admins can update user roles"
    ON public.users
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
      )
    );
END $$;
