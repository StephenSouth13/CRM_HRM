-- Migration: Add notification_settings to profiles table
-- Purpose: Store user notification preferences (email notifications for tasks, approvals, daily reports)

-- ============================================================================
-- 1. ADD notification_settings COLUMN TO profiles TABLE
-- ============================================================================

ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT jsonb_build_object(
  'email_new_tasks', true,
  'email_approvals', true,
  'email_daily_reports', true,
  'in_app_notifications', true
);

CREATE INDEX IF NOT EXISTS idx_profiles_notification_settings ON public.profiles USING GIN (notification_settings);

-- ============================================================================
-- 2. ADD theme_preference COLUMN TO profiles TABLE
-- ============================================================================

ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(20) DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system'));

CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference ON public.profiles(theme_preference);

-- ============================================================================
-- Note: RLS is already enabled on public.profiles
-- Users can update their own notification_settings and theme_preference
-- ============================================================================
