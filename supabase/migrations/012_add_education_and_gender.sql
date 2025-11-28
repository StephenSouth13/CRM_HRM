-- Migration: 010_add_education_and_gender.sql
-- Thêm các cột mới vào bảng profiles để hỗ trợ chức năng Profile.tsx mới nhất.

--------------------------------------------------------------------------------
-- 1. THÊM CÁC CỘT MỚI (Sử dụng VARCHAR/TEXT để tránh lỗi ENUM)
--------------------------------------------------------------------------------

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NULL; -- Ví dụ: Nam, Nữ, Khác

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) NULL; -- Ví dụ: Employed, Student, Trainee

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS university TEXT NULL; -- Trường Đại học/Cao đẳng

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS major TEXT NULL; -- Chuyên ngành

--------------------------------------------------------------------------------
-- 2. TẠO INDEX (Tùy chọn, để tăng tốc độ tìm kiếm)
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_employment_status ON public.profiles(employment_status);