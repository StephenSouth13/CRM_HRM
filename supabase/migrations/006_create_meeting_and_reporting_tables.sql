-- ============================================================================
-- MIGRATION: 006_create_meeting_and_reporting_tables.sql
-- PURPOSE: Create meeting management, reporting, and documentation tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE MEETING_ROOMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
    capacity INTEGER NOT NULL DEFAULT 1,
    equipment VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
    is_active BOOLEAN DEFAULT TRUE,
    floor VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_rooms_is_active ON public.meeting_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_capacity ON public.meeting_rooms(capacity);

-- ============================================================================
-- 2. CREATE ROOM_BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.room_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Booking details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    -- Approval workflow
    status booking_status DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent double-booking
    CONSTRAINT valid_booking_time CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_room_bookings_room_id ON public.room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_user_id ON public.room_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_status ON public.room_bookings(status);
CREATE INDEX IF NOT EXISTS idx_room_bookings_start_time ON public.room_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_room_bookings_end_time ON public.room_bookings(end_time);

-- ============================================================================
-- 3. CREATE DAILY_REPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    
    -- Report content
    content TEXT NOT NULL,
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One report per user per day
    CONSTRAINT unique_daily_report UNIQUE(user_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON public.daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON public.daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON public.daily_reports(created_at DESC);

-- ============================================================================
-- 4. CREATE MEETING_MINUTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    meeting_date TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Meeting details
    location VARCHAR(255),
    attendees UUID[] DEFAULT ARRAY[]::UUID[],
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_created_by ON public.meeting_minutes(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting_date ON public.meeting_minutes(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status ON public.meeting_minutes(status);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_created_at ON public.meeting_minutes(created_at DESC);

-- ============================================================================
-- 5. CREATE ACTION_ITEMS TABLE (From meetings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    
    -- Item details
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date DATE,
    priority task_priority DEFAULT 'medium',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    
    -- Relationships
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON public.action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_task_id ON public.action_items(task_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON public.action_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON public.action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON public.action_items(due_date);

-- ============================================================================
-- 6. CREATE TEAM_WORKLOAD TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_workload (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    
    -- Workload metrics
    total_tasks_assigned INTEGER DEFAULT 0,
    total_tasks_in_progress INTEGER DEFAULT 0,
    total_tasks_overdue INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    workload_percentage NUMERIC(5, 2) DEFAULT 0.00,
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- One record per user
    CONSTRAINT unique_workload UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_workload_user_id ON public.team_workload(user_id);
CREATE INDEX IF NOT EXISTS idx_team_workload_team_id ON public.team_workload(team_id);
CREATE INDEX IF NOT EXISTS idx_team_workload_percentage ON public.team_workload(workload_percentage DESC);

-- ============================================================================
-- 7. ADD TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_meeting_rooms_updated_at ON public.meeting_rooms;
CREATE TRIGGER update_meeting_rooms_updated_at BEFORE UPDATE ON public.meeting_rooms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_bookings_updated_at ON public.room_bookings;
CREATE TRIGGER update_room_bookings_updated_at BEFORE UPDATE ON public.room_bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER update_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_minutes_updated_at ON public.meeting_minutes;
CREATE TRIGGER update_meeting_minutes_updated_at BEFORE UPDATE ON public.meeting_minutes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_action_items_updated_at ON public.action_items;
CREATE TRIGGER update_action_items_updated_at BEFORE UPDATE ON public.action_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
