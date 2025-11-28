-- Migration: Comprehensive HRM Schema Update
-- Updates existing tables and creates new tables for attendance shifts, positions, salaries, projects, and profile approvals

-- ============================================================================
-- 1. CREATE POSITIONS TABLE (Leader, HR, IT, Content, Design)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default positions
INSERT INTO public.positions (name, description) VALUES
  ('Leader', 'Team Leader'),
  ('HR', 'Human Resources'),
  ('IT', 'Information Technology'),
  ('Content', 'Content Creator'),
  ('Design', 'Designer')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_positions_name ON public.positions(name);


-- ============================================================================
-- 2. UPDATE PROFILES TABLE - Add position_id
-- ============================================================================
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles(position_id);


-- ============================================================================
-- 3. CREATE TEAM_LEADERS TABLE (Many-to-Many: support multiple leaders per team)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_leaders UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_leaders_team_id ON public.team_leaders(team_id);
CREATE INDEX IF NOT EXISTS idx_team_leaders_user_id ON public.team_leaders(user_id);


-- ============================================================================
-- 4. UPDATE ATTENDANCE TABLE - Add shift and leave columns
-- ============================================================================
ALTER TABLE IF EXISTS public.attendance ADD COLUMN IF NOT EXISTS shift_type VARCHAR(50) DEFAULT 'morning' CHECK (shift_type IN ('morning', 'afternoon', 'overtime'));
ALTER TABLE IF EXISTS public.attendance ADD COLUMN IF NOT EXISTS is_leave BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.attendance ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) CHECK (leave_type IN ('annual', 'sick', 'unpaid', NULL));

CREATE INDEX IF NOT EXISTS idx_attendance_shift_type ON public.attendance(shift_type);
CREATE INDEX IF NOT EXISTS idx_attendance_is_leave ON public.attendance(is_leave);
CREATE INDEX IF NOT EXISTS idx_attendance_leave_type ON public.attendance(leave_type);


-- ============================================================================
-- 5. CREATE SALARIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary DECIMAL(12, 2) NOT NULL,
  allowances DECIMAL(12, 2) DEFAULT 0,
  bonus DECIMAL(12, 2) DEFAULT 0,
  deductions DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  net_salary DECIMAL(12, 2) GENERATED ALWAYS AS (base_salary + allowances + bonus - deductions - tax_amount) STORED,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  payment_date DATE,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salaries_user_id ON public.salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_pay_period ON public.salaries(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_status ON public.salaries(payment_status);


-- ============================================================================
-- 6. CREATE SALARY_COMPLAINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.salary_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  complaint_type VARCHAR(100) NOT NULL CHECK (complaint_type IN ('calculation_error', 'missing_allowance', 'bonus_issue', 'deduction_error', 'other')),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'rejected')),
  resolution_notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salary_complaints_user_id ON public.salary_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_complaints_status ON public.salary_complaints(status);
CREATE INDEX IF NOT EXISTS idx_salary_complaints_assigned_to ON public.salary_complaints(assigned_to);


-- ============================================================================
-- 7. CREATE PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  color VARCHAR(20) DEFAULT 'blue',
  icon VARCHAR(10) DEFAULT '🚀',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);


-- ============================================================================
-- 8. UPDATE TASKS TABLE - Add project_id and color
-- ============================================================================
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT 'blue' CHECK (color IN ('blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray'));
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🧩';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_color ON public.tasks(color);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);


-- ============================================================================
-- 9. CREATE PROFILE_UPDATE_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profile_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_update_requests_user_id ON public.profile_update_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_status ON public.profile_update_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_update_requests_reviewed_by ON public.profile_update_requests(reviewed_by);


-- ============================================================================
-- 10. CREATE UPDATED VIEWS
-- ============================================================================

-- View: team_with_leaders (includes leader information)
CREATE OR REPLACE VIEW public.team_with_leaders AS
SELECT
  t.id,
  t.name,
  t.description,
  t.department,
  t.manager_id,
  t.created_at,
  t.updated_at,
  json_agg(
    json_build_object(
      'id', tl.user_id,
      'full_name', p.full_name,
      'email', p.email,
      'avatar_url', p.avatar_url
    )
  ) FILTER (WHERE tl.user_id IS NOT NULL) AS leaders
FROM public.teams t
LEFT JOIN public.team_leaders tl ON t.id = tl.team_id
LEFT JOIN public.profiles p ON tl.user_id = p.id
GROUP BY t.id, t.name, t.description, t.department, t.manager_id, t.created_at, t.updated_at;

-- View: attendance_with_leave (for attendance tracking with leave information)
CREATE OR REPLACE VIEW public.attendance_with_leave AS
SELECT
  a.*,
  p.email AS user_email,
  p.full_name AS user_name,
  lr.id AS leave_request_id,
  lr.leave_type AS leave_request_type
FROM public.attendance a
LEFT JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.leave_requests lr ON
  a.user_id = lr.user_id
  AND DATE(a.timestamp) >= lr.start_date
  AND DATE(a.timestamp) <= lr.end_date;

-- View: user_salary_overview (current month salary details)
CREATE OR REPLACE VIEW public.user_salary_overview AS
SELECT
  p.id,
  p.full_name,
  p.email,
  s.base_salary,
  s.allowances,
  s.bonus,
  s.deductions,
  s.tax_amount,
  s.net_salary,
  s.pay_period_start,
  s.pay_period_end,
  s.payment_status,
  t.name AS team_name
FROM public.profiles p
LEFT JOIN public.salaries s ON p.id = s.user_id
LEFT JOIN public.teams t ON p.team_id = t.id
WHERE DATE_TRUNC('month', s.pay_period_start) = DATE_TRUNC('month', CURRENT_DATE)
   OR s.id IS NULL;

-- ============================================================================
-- 11. CLEANUP: Drop old shift_attendance table if it exists
-- ============================================================================
DROP TABLE IF EXISTS public.shift_attendance CASCADE;
DROP TABLE IF EXISTS public.shift_configurations CASCADE;
DROP TABLE IF EXISTS public.attendance_settings CASCADE;
DROP VIEW IF EXISTS public.shift_attendance_view CASCADE;

-- ============================================================================
-- 12. ENABLE ROW LEVEL SECURITY (RLS) ON NEW TABLES
-- ============================================================================
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. RLS POLICIES
-- ============================================================================

-- SALARIES: Users can view their own, Admins can view all
CREATE POLICY "Users can view own salary" ON public.salaries
  FOR SELECT USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins and HR can manage salaries" ON public.salaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr'))
  );

-- SALARY_COMPLAINTS: Users can create their own, Admins/HR can view all
CREATE POLICY "Users can create salary complaints" ON public.salary_complaints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own complaints" ON public.salary_complaints
  FOR SELECT USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr')));

CREATE POLICY "Admins and HR can manage complaints" ON public.salary_complaints
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr'))
  );

-- PROJECTS: Based on team access
CREATE POLICY "Users can view their team projects" ON public.projects
  FOR SELECT USING (
    team_id IS NULL OR
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr'))
  );

-- PROFILE_UPDATE_REQUESTS: Users can create their own, Admins review
CREATE POLICY "Users can create own profile requests" ON public.profile_update_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON public.profile_update_requests
  FOR SELECT USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can review profile requests" ON public.profile_update_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- TEAM_LEADERS: Admins and Leaders can view
CREATE POLICY "Leaders and Admins can view team leaders" ON public.team_leaders
  FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM public.team_leaders WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'hr'))
  );

CREATE POLICY "Admins can manage team leaders" ON public.team_leaders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
