-- =============================================
-- 010: نظام العائلات والدعوات مع عزل البيانات
-- =============================================

-- ========== 1. جدول العائلات ==========
CREATE TABLE public.families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- ========== 2. إضافة family_id للمستخدمين ==========
ALTER TABLE public.users ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;

-- ========== 3. جدول الدعوات ==========
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL UNIQUE,
    invited_role user_role NOT NULL DEFAULT 'user',
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ========== 4. ربط البيانات الحالية ==========
-- إنشاء عائلة لكل أدمن موجود حالياً وربط مستخدميه
DO $$
DECLARE
    admin_rec RECORD;
    new_family_id UUID;
BEGIN
    -- لكل أدمن موجود، أنشئ عائلة
    FOR admin_rec IN SELECT id, name FROM public.users WHERE role = 'admin' ORDER BY created_at ASC LOOP
        new_family_id := uuid_generate_v4();
        INSERT INTO public.families (id, name, owner_id, created_at)
        VALUES (new_family_id, 'عائلة ' || admin_rec.name, admin_rec.id, NOW());

        -- ربط الأدمن بعائلته
        UPDATE public.users SET family_id = new_family_id WHERE id = admin_rec.id;
    END LOOP;

    -- ربط المستخدمين بدون عائلة بأول عائلة متاحة (إن وُجدت)
    UPDATE public.users u SET family_id = (
        SELECT f.id FROM public.families f ORDER BY f.created_at ASC LIMIT 1
    )
    WHERE u.family_id IS NULL AND EXISTS (SELECT 1 FROM public.families);
END $$;

-- ========== 5. تحديث دالة handle_new_user ==========
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

    -- كل مستخدم جديد بدون دعوة يصبح أدمن مع عائلة مستقلة
    new_family_id := uuid_generate_v4();

    -- إنشاء العائلة أولاً (بدون owner_id مؤقتاً)
    INSERT INTO public.families (id, name, owner_id, created_at)
    VALUES (new_family_id, 'عائلة ' || user_name, NEW.id, NOW());

    -- إنشاء المستخدم كأدمن مع ربطه بالعائلة
    INSERT INTO public.users (id, email, name, role, avatar_url, family_id)
    VALUES (
        NEW.id,
        NEW.email,
        user_name,
        'admin',
        NEW.raw_user_meta_data->>'avatar_url',
        new_family_id
    );

    RETURN NEW;
END;
$$;

-- ========== 6. دالة استرداد الدعوة ==========
CREATE OR REPLACE FUNCTION public.redeem_invitation(invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    inv RECORD;
    current_user_id UUID;
    old_family_id UUID;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مسجل الدخول');
    END IF;

    -- البحث عن الدعوة
    SELECT * INTO inv FROM public.invitations
    WHERE code = invite_code
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'كود الدعوة غير صحيح');
    END IF;

    -- التحقق من الصلاحية
    IF inv.used_by IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً');
    END IF;

    IF inv.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'انتهت صلاحية كود الدعوة');
    END IF;

    -- التحقق أن المستخدم ليس بالفعل في نفس العائلة
    SELECT family_id INTO old_family_id FROM public.users WHERE id = current_user_id;

    IF old_family_id = inv.family_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'أنت بالفعل عضو في هذه العائلة');
    END IF;

    -- تحديث المستخدم: ربطه بالعائلة الجديدة + الدور
    UPDATE public.users
    SET family_id = inv.family_id,
        role = inv.invited_role
    WHERE id = current_user_id;

    -- تحديث الدعوة كمُستخدمة
    UPDATE public.invitations
    SET used_by = current_user_id,
        used_at = NOW()
    WHERE id = inv.id;

    RETURN jsonb_build_object(
        'success', true,
        'family_id', inv.family_id,
        'role', inv.invited_role
    );
END;
$$;

-- ========== 7. سياسات RLS للعائلات ==========

-- العائلات: المستخدم يرى عائلته فقط
CREATE POLICY "families_select_own" ON public.families
    FOR SELECT TO authenticated
    USING (id = (SELECT family_id FROM public.users WHERE id = auth.uid()));

-- العائلات: المالك يستطيع التعديل
CREATE POLICY "families_update_owner" ON public.families
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- ========== 8. سياسات RLS للدعوات ==========

-- الأدمن يرى دعوات عائلته
CREATE POLICY "invitations_select_family_admin" ON public.invitations
    FOR SELECT TO authenticated
    USING (
        family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        AND public.is_admin()
    );

-- الأدمن يُنشئ دعوات لعائلته
CREATE POLICY "invitations_insert_admin" ON public.invitations
    FOR INSERT TO authenticated
    WITH CHECK (
        family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        AND public.is_admin()
    );

-- ========== 9. تحديث سياسات RLS للسجلات ==========

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "records_select_authenticated" ON public.records;
DROP POLICY IF EXISTS "records_insert_authenticated" ON public.records;
DROP POLICY IF EXISTS "records_update_admin" ON public.records;
DROP POLICY IF EXISTS "records_delete_admin" ON public.records;

-- السجلات: المستخدم يرى سجلات عائلته فقط
CREATE POLICY "records_select_family" ON public.records
    FOR SELECT TO authenticated
    USING (
        created_by IN (
            SELECT id FROM public.users
            WHERE family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        )
    );

-- السجلات: المستخدم يضيف سجلات (مرتبطة بنفسه)
CREATE POLICY "records_insert_family" ON public.records
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- السجلات: الأدمن يعدّل سجلات عائلته فقط
CREATE POLICY "records_update_family_admin" ON public.records
    FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        AND created_by IN (
            SELECT id FROM public.users
            WHERE family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        public.is_admin()
        AND created_by IN (
            SELECT id FROM public.users
            WHERE family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        )
    );

-- السجلات: الأدمن يحذف سجلات عائلته فقط
CREATE POLICY "records_delete_family_admin" ON public.records
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
        AND created_by IN (
            SELECT id FROM public.users
            WHERE family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        )
    );

-- ========== 10. تحديث سياسات RLS للصور ==========

DROP POLICY IF EXISTS "images_select_authenticated" ON public.images;
DROP POLICY IF EXISTS "images_insert_authenticated" ON public.images;
DROP POLICY IF EXISTS "images_delete_admin" ON public.images;
DROP POLICY IF EXISTS "images_update_admin" ON public.images;

-- الصور: المستخدم يرى صور سجلات عائلته
CREATE POLICY "images_select_family" ON public.images
    FOR SELECT TO authenticated
    USING (
        record_id IN (
            SELECT r.id FROM public.records r
            WHERE r.created_by IN (
                SELECT u.id FROM public.users u
                WHERE u.family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
            )
        )
    );

-- الصور: المستخدم يرفع صور لسجلات عائلته
CREATE POLICY "images_insert_family" ON public.images
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = uploaded_by
        AND record_id IN (
            SELECT r.id FROM public.records r
            WHERE r.created_by IN (
                SELECT u.id FROM public.users u
                WHERE u.family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
            )
        )
    );

-- الصور: الأدمن يحذف صور سجلات عائلته
CREATE POLICY "images_delete_family_admin" ON public.images
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
        AND record_id IN (
            SELECT r.id FROM public.records r
            WHERE r.created_by IN (
                SELECT u.id FROM public.users u
                WHERE u.family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
            )
        )
    );

-- الصور: الأدمن يعدّل بيانات صور عائلته
CREATE POLICY "images_update_family_admin" ON public.images
    FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        AND record_id IN (
            SELECT r.id FROM public.records r
            WHERE r.created_by IN (
                SELECT u.id FROM public.users u
                WHERE u.family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
            )
        )
    )
    WITH CHECK (
        public.is_admin()
        AND record_id IN (
            SELECT r.id FROM public.records r
            WHERE r.created_by IN (
                SELECT u.id FROM public.users u
                WHERE u.family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
            )
        )
    );

-- ========== 11. تحديث سياسات المستخدمين ==========
-- الأدمن يرى فقط أعضاء عائلته
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_family" ON public.users
    FOR SELECT TO authenticated
    USING (
        family_id = (SELECT family_id FROM public.users WHERE id = auth.uid())
        OR id = auth.uid()
    );
