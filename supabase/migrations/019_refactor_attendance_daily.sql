-- Migration: Refactor attendance from shift-based to daily with multi-session support
-- Includes: attendance_sessions (individual check-in/out), daily_attendance (aggregated), attendance_settings (config)

-- ============================================================================
-- 1. CREATE attendance_sessions TABLE
-- ============================================================================
-- Tracks individual check-in/check-out sessions (supports multi-session per day)
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE,
    location_checkin TEXT,
    location_checkout TEXT,
    notes TEXT,
    is_auto_checkout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for attendance_sessions
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_id ON public.attendance_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_date ON public.attendance_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_check_out_status ON public.attendance_sessions(user_id) WHERE check_out IS NULL;

-- ============================================================================
-- 2. CREATE daily_attendance TABLE
-- ============================================================================
-- Aggregated daily attendance data (computed from sessions)
CREATE TABLE IF NOT EXISTS public.daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    total_hours NUMERIC(5, 2) DEFAULT 0,
    session_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'present', 'absent', 'late', 'leave')),
    notes TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, attendance_date)
);

-- Indexes for daily_attendance
CREATE INDEX IF NOT EXISTS idx_daily_attendance_user_id ON public.daily_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON public.daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_user_date ON public.daily_attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status ON public.daily_attendance(status);

-- ============================================================================
-- 3. CREATE attendance_settings TABLE
-- ============================================================================
-- Global and team-specific attendance configuration
CREATE TABLE IF NOT EXISTS public.attendance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
    auto_checkout_enabled BOOLEAN DEFAULT TRUE,
    auto_checkout_time TIME DEFAULT '23:59:00',
    max_hours_per_day NUMERIC(5, 2) DEFAULT 14,
    office_latitude NUMERIC(9, 6),
    office_longitude NUMERIC(9, 6),
    check_in_radius_meters INT DEFAULT 100,
    require_location_checkin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for attendance_settings
CREATE INDEX IF NOT EXISTS idx_attendance_settings_team_id ON public.attendance_settings(team_id);

-- Insert global default settings (team_id = NULL means global)
INSERT INTO public.attendance_settings (auto_checkout_enabled, auto_checkout_time, max_hours_per_day)
VALUES (TRUE, '23:59:00', 14)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES FOR attendance_sessions
-- ============================================================================

-- Users can view own sessions
CREATE POLICY "Users can view own attendance sessions" ON public.attendance_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role, 'leader'::app_role))
    );

-- Users can create own sessions (check-in)
CREATE POLICY "Users can create own sessions" ON public.attendance_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own unclosed sessions (check-out)
CREATE POLICY "Users can checkout own sessions" ON public.attendance_sessions
    FOR UPDATE USING (auth.uid() = user_id AND check_out IS NULL);

-- Admin/HR can manage all sessions
CREATE POLICY "Admin HR can manage all sessions" ON public.attendance_sessions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- ============================================================================
-- 6. CREATE RLS POLICIES FOR daily_attendance
-- ============================================================================

-- Users can view own daily records
CREATE POLICY "Users can view own daily attendance" ON public.daily_attendance
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role, 'leader'::app_role))
    );

-- Admin/HR can manage all records
CREATE POLICY "Admin HR can manage all daily attendance" ON public.daily_attendance
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- ============================================================================
-- 7. CREATE RLS POLICIES FOR attendance_settings
-- ============================================================================

-- Everyone can view settings
CREATE POLICY "Everyone can view attendance settings" ON public.attendance_settings
    FOR SELECT USING (true);

-- Only admin/HR can modify
CREATE POLICY "Admin HR can manage attendance settings" ON public.attendance_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- ============================================================================
-- 8. CREATE TRIGGER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate daily_attendance from sessions
CREATE OR REPLACE FUNCTION calculate_daily_attendance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_hours NUMERIC;
    v_session_count INT;
    v_first_checkin TIMESTAMP WITH TIME ZONE;
    v_last_checkout TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate totals for the day
    SELECT 
        COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in)) / 3600), 0),
        COUNT(*),
        MIN(check_in),
        MAX(check_out)
    INTO v_total_hours, v_session_count, v_first_checkin, v_last_checkout
    FROM public.attendance_sessions
    WHERE user_id = NEW.user_id AND session_date = NEW.session_date AND check_out IS NOT NULL;

    -- Upsert into daily_attendance
    INSERT INTO public.daily_attendance (user_id, attendance_date, check_in_time, check_out_time, total_hours, session_count, status)
    VALUES (NEW.user_id, NEW.session_date, v_first_checkin, v_last_checkout, v_total_hours, v_session_count, 'present')
    ON CONFLICT (user_id, attendance_date) DO UPDATE SET
        check_in_time = v_first_checkin,
        check_out_time = v_last_checkout,
        total_hours = v_total_hours,
        session_count = v_session_count,
        status = 'present',
        updated_at = NOW();

    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 9. CREATE TRIGGERS
-- ============================================================================

-- Update updated_at on attendance_sessions
CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on daily_attendance
CREATE TRIGGER update_daily_attendance_updated_at BEFORE UPDATE ON public.daily_attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on attendance_settings
CREATE TRIGGER update_attendance_settings_updated_at BEFORE UPDATE ON public.attendance_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatically update daily_attendance when session is created/updated
CREATE TRIGGER recalc_daily_on_session_change AFTER INSERT OR UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION calculate_daily_attendance();

-- ============================================================================
-- 10. CREATE AUTO-CHECKOUT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_checkout_unclosed_sessions(max_hours_limit NUMERIC DEFAULT 14)
RETURNS jsonb AS $$
DECLARE
    v_count INT := 0;
    v_session RECORD;
    v_checkout_time TIMESTAMP WITH TIME ZONE;
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
        v_checkout_time := (v_session.session_date || ' ' || COALESCE(v_settings.auto_checkout_time, '23:59:00'))::TIMESTAMP WITH TIME ZONE;

        -- Calculate hours
        v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_session.check_in)) / 3600;

        -- Only auto-checkout if hours are within limit
        IF v_hours > 0 AND v_hours <= v_settings.max_hours_per_day THEN
            UPDATE public.attendance_sessions
            SET check_out = v_checkout_time,
                is_auto_checkout = TRUE,
                notes = COALESCE(notes, '') || ' [Auto-checkout do không bấm Ra]'
            WHERE id = v_session.id;

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('count', v_count, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.attendance_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_attendance TO authenticated;
GRANT SELECT ON public.attendance_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_checkout_unclosed_sessions TO authenticated;
