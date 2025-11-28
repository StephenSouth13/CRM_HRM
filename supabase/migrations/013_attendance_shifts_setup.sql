-- Migration: Add shift-based attendance tables and views for shift management
-- Includes: shift_configurations, shift_attendance, attendance_settings, and shift_attendance_view

-- 1) shift_configurations
-- Stores shift schedules for each team (morning, afternoon, overtime, etc.)
CREATE TABLE IF NOT EXISTS public.shift_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'overtime')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_configurations_team_id
  ON public.shift_configurations (team_id);

CREATE INDEX IF NOT EXISTS idx_shift_configurations_shift_type
  ON public.shift_configurations (shift_type);


-- 2) shift_attendance
-- Tracks employee check-in/check-out for each shift
CREATE TABLE IF NOT EXISTS public.shift_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'overtime')),
  date DATE NOT NULL,
  check_in TIMESTAMPTZ NULL,
  check_out TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'checked_in', 'completed', 'absent')),
  location TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevent duplicate attendance rows for same user + date + shift
  CONSTRAINT uq_shift_attendance_user_date_shift UNIQUE (user_id, date, shift_type)
);

-- Useful indexes for lookups and reports
CREATE INDEX IF NOT EXISTS idx_shift_attendance_user_id
  ON public.shift_attendance (user_id);

CREATE INDEX IF NOT EXISTS idx_shift_attendance_date
  ON public.shift_attendance (date);

CREATE INDEX IF NOT EXISTS idx_shift_attendance_shift_date
  ON public.shift_attendance (shift_type, date);


-- 3) attendance_settings
-- Stores location-based check-in settings per team
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  office_latitude NUMERIC(9,6) NULL,
  office_longitude NUMERIC(9,6) NULL,
  check_in_radius INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for team_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_settings_team_id
  ON public.attendance_settings (team_id);


-- 4) View: shift_attendance_view
-- Joins shift_attendance with user profile data for easier querying
CREATE OR REPLACE VIEW public.shift_attendance_view AS
SELECT
  sa.*,
  p.email AS user_email,
  (CONCAT_WS(' ', NULLIF(p.last_name, ''), NULLIF(p.first_name, '')))::TEXT AS user_name,
  t.id AS team_id
FROM public.shift_attendance sa
LEFT JOIN public.profiles p ON p.id = sa.user_id
LEFT JOIN public.teams t ON t.id = p.team_id;
