-- ============================================================================
-- MIGRATION: 003_create_attendance_tables.sql
-- PURPOSE: Create attendance tracking and shift configuration tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE ATTENDANCE_SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
    
    -- Auto-checkout configuration
    auto_checkout_enabled BOOLEAN DEFAULT TRUE,
    auto_checkout_time TIME DEFAULT '23:59:00',
    max_hours_per_day NUMERIC(5, 2) DEFAULT 14.00,
    
    -- Location-based check-in
    office_latitude NUMERIC(9, 6),
    office_longitude NUMERIC(9, 6),
    check_in_radius_meters INTEGER DEFAULT 100,
    require_location_checkin BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.attendance_settings (auto_checkout_enabled, auto_checkout_time, max_hours_per_day)
VALUES (TRUE, '23:59:00'::TIME, 14.00)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_attendance_settings_team_id ON public.attendance_settings(team_id);

-- ============================================================================
-- 2. CREATE ATTENDANCE_SESSIONS TABLE (Individual check-in/out sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    
    -- Check-in and check-out timestamps
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    
    -- Location tracking
    location_checkin VARCHAR(500),
    location_checkout VARCHAR(500),
    
    -- Additional info
    notes TEXT,
    is_auto_checkout BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate entries for same date
    CONSTRAINT unique_user_session UNIQUE(user_id, session_date, check_in)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_id ON public.attendance_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_date ON public.attendance_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_unclosed ON public.attendance_sessions(user_id) WHERE check_out IS NULL;

-- ============================================================================
-- 3. CREATE DAILY_ATTENDANCE TABLE (Aggregated daily records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    
    -- Aggregated timing
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    total_hours NUMERIC(5, 2) DEFAULT 0.00,
    session_count INTEGER DEFAULT 0,
    
    -- Status and approval
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'present', 'absent', 'late', 'leave')),
    notes TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one record per user per day
    CONSTRAINT unique_daily_attendance UNIQUE(user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_user_id ON public.daily_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON public.daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_user_date ON public.daily_attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status ON public.daily_attendance(status);

-- ============================================================================
-- 4. ADD TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_attendance_settings_updated_at ON public.attendance_settings;
CREATE TRIGGER update_attendance_settings_updated_at BEFORE UPDATE ON public.attendance_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_sessions_updated_at ON public.attendance_sessions;
CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_attendance_updated_at ON public.daily_attendance;
CREATE TRIGGER update_daily_attendance_updated_at BEFORE UPDATE ON public.daily_attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. CREATE FUNCTION TO CALCULATE DAILY ATTENDANCE FROM SESSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_daily_attendance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_hours NUMERIC;
    v_session_count INTEGER;
    v_first_checkin TIMESTAMPTZ;
    v_last_checkout TIMESTAMPTZ;
BEGIN
    -- Calculate totals for the day from completed sessions
    SELECT 
        COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in)) / 3600), 0),
        COUNT(*),
        MIN(check_in),
        MAX(check_out)
    INTO v_total_hours, v_session_count, v_first_checkin, v_last_checkout
    FROM public.attendance_sessions
    WHERE user_id = NEW.user_id 
      AND session_date = NEW.session_date 
      AND check_out IS NOT NULL;

    -- Upsert into daily_attendance
    INSERT INTO public.daily_attendance (
        user_id, attendance_date, check_in_time, check_out_time, 
        total_hours, session_count, status
    )
    VALUES (
        NEW.user_id, 
        NEW.session_date, 
        v_first_checkin, 
        v_last_checkout, 
        v_total_hours, 
        v_session_count, 
        'present'
    )
    ON CONFLICT (user_id, attendance_date) DO UPDATE SET
        check_in_time = v_first_checkin,
        check_out_time = v_last_checkout,
        total_hours = v_total_hours,
        session_count = v_session_count,
        status = 'present',
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate daily attendance when a session is created or updated
DROP TRIGGER IF EXISTS recalc_daily_on_session_change ON public.attendance_sessions;
CREATE TRIGGER recalc_daily_on_session_change AFTER INSERT OR UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION public.calculate_daily_attendance();

-- ============================================================================
-- 6. CREATE FUNCTION FOR AUTO-CHECKOUT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_checkout_unclosed_sessions(max_hours_limit NUMERIC DEFAULT 14.00)
RETURNS jsonb AS $$
DECLARE
    v_count INTEGER := 0;
    v_session RECORD;
    v_checkout_time TIMESTAMPTZ;
    v_hours NUMERIC;
    v_settings RECORD;
BEGIN
    -- Get global settings or use defaults
    SELECT auto_checkout_time, max_hours_per_day
    INTO v_settings
    FROM public.attendance_settings
    WHERE team_id IS NULL
    LIMIT 1;

    IF v_settings IS NULL THEN
        v_settings := ROW('23:59:00'::TIME, max_hours_limit);
    END IF;

    -- Find all unclosed sessions from yesterday or earlier
    FOR v_session IN
        SELECT id, check_in, session_date
        FROM public.attendance_sessions
        WHERE check_out IS NULL
        AND session_date < CURRENT_DATE
        ORDER BY session_date, check_in
    LOOP
        -- Set checkout time to the auto-checkout time configured
        v_checkout_time := (v_session.session_date || ' ' || COALESCE(v_settings.auto_checkout_time, '23:59:00'))::TIMESTAMPTZ;

        -- Calculate hours
        v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_session.check_in)) / 3600;

        -- Only auto-checkout if hours are within limit
        IF v_hours > 0 AND v_hours <= v_settings.max_hours_per_day THEN
            UPDATE public.attendance_sessions
            SET check_out = v_checkout_time,
                is_auto_checkout = TRUE,
                notes = COALESCE(notes, '') || ' [Auto-checkout - no manual checkout]'
            WHERE id = v_session.id;

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('count', v_count, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
