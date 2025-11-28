-- Migration: Expand roles and add HR permissions (Đã loại bỏ bảng salary_complaints)

-- ============================================================================
-- 1. EXPAND app_role ENUM WITH NEW ROLES
-- ============================================================================

-- Thêm các giá trị mới vào ENUM app_role đã tồn tại
-- Sử dụng cú pháp DO $$ BEGIN END $$ để kiểm tra và thêm giá trị an toàn
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'leader', 'staff');
    END IF;
    -- Thêm các giá trị mới nếu chúng chưa tồn tại
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'hr') THEN
        ALTER TYPE app_role ADD VALUE 'hr' AFTER 'admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'teacher') THEN
        ALTER TYPE app_role ADD VALUE 'teacher';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'it') THEN
        ALTER TYPE app_role ADD VALUE 'it';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'content') THEN
        ALTER TYPE app_role ADD VALUE 'content';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel = 'design') THEN
        ALTER TYPE app_role ADD VALUE 'design';
    END IF;
END $$;


-- ============================================================================
-- 2. UPDATE SALARIES TABLE RLS POLICIES (CẤP QUYỀN DUYỆT LƯƠNG CHO HR)
-- ============================================================================

-- BƯỚC NÀY SẼ CHẠY DROP POLICY VÀ CREATE LẠI, RẤT QUAN TRỌNG VÀ AN TOÀN

-- 2.1 Xóa chính sách SELECT cũ
DROP POLICY IF EXISTS "Users can view own salary" ON public.salaries;
DROP POLICY IF EXISTS "Admins and HR can manage salaries" ON public.salaries;

-- 2.2 Chính sách SELECT mới: Users có thể xem lương của mình, Admins và HR có thể xem tất cả
CREATE POLICY "Users can view own salary" ON public.salaries
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- 2.3 Chính sách ALL mới: Admins và HR có thể thêm/sửa/xóa tất cả lương
CREATE POLICY "Admins and HR can manage salaries" ON public.salaries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );
