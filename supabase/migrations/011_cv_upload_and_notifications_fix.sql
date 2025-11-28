-- Migration: 20251117145800_cv_upload_and_notifications_fix.sql
-- Mục đích: Bổ sung chức năng tải lên CV cá nhân, thiết lập RLS Storage và hoàn thiện RLS cho bảng salaries.

--------------------------------------------------------------------------------
-- BƯỚC 1: CẬP NHẬT BẢNG PROFILES ĐỂ LƯU CV URL
--------------------------------------------------------------------------------

-- Thêm cột cv_url vào bảng profiles (sử dụng IF NOT EXISTS để an toàn khi chạy lại)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cv_url TEXT;

--------------------------------------------------------------------------------
-- BƯỚC 2: TẠO STORAGE BUCKET MỚI CHO TÀI LIỆU (CV)
--------------------------------------------------------------------------------

-- Tạo storage bucket 'documents' (FALSE = yêu cầu xác thực để truy cập, chỉ Admin và User tự quản lý)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', FALSE)
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- BƯỚC 3: THIẾT LẬP RLS CHO BUCKET 'documents' (CVs)
--------------------------------------------------------------------------------

-- 3.1 Cho phép người dùng tải lên/ghi đè CV của chính họ
-- Ràng buộc: bucket_id = 'documents' và tên file bắt đầu bằng UID của user
CREATE POLICY "Users can upload their own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3.2 Cho phép người dùng xem CV của chính họ
CREATE POLICY "Users can view their own CV"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3.3 Cho phép Quản trị viên (Admin) xem bất kỳ CV nào
-- Yêu cầu: Hàm public.has_role() phải tồn tại (đã có trong migration cũ)
CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3.4 Cho phép người dùng cập nhật/ghi đè CV của chính họ
CREATE POLICY "Users can update their own CV"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3.5 Cho phép người dùng xóa CV của chính họ
CREATE POLICY "Users can delete their own CV"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

--------------------------------------------------------------------------------
-- BƯỚC 4: CẬP NHẬT RÀNG BUỘC FK VÀ RLS CHO BẢNG LƯƠNG (salaries)
--------------------------------------------------------------------------------

-- 4.1 Thêm ràng buộc Foreign Key từ salaries.user_id đến profiles.id (Đảm bảo tính toàn vẹn dữ liệu)
-- Sử dụng ALTER TABLE IF EXISTS và DROP CONSTRAINT IF EXISTS để tránh lỗi chạy lại
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'salaries_user_id_fkey'
  ) THEN
    ALTER TABLE public.salaries
    ADD CONSTRAINT salaries_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;


-- 4.2 Cập nhật chính sách RLS: Cho phép User xem lương của chính họ (BỔ SUNG)
-- Chính sách này sẽ cho phép người dùng xem hồ sơ lương của riêng mình
CREATE POLICY "Users can view their own salaries"
ON public.salaries
FOR SELECT
USING (auth.uid() = user_id);

-- Lưu ý: Các chính sách Admin đã được tạo trong file migration cũ (Admins can view/manage salaries).