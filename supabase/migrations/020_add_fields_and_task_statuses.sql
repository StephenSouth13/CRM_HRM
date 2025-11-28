-- Migration: Add Fields (Epics) and Custom Task Statuses

-- ============================================================================
-- 1. CREATE TASK_STATUS_ENUM - Removed in favor of string type for flexibility
-- ============================================================================

-- Drop old enum constraint and recreate tasks table with flexible status
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Create task_statuses table for team-specific/workspace-specific statuses
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT 'gray' CHECK (color IN ('blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan')),
  position INT DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_statuses UNIQUE (team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_statuses_team_id ON public.task_statuses(team_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_position ON public.task_statuses(position);

-- ============================================================================
-- 2. CREATE FIELDS TABLE (Epics/Categories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT 'blue' CHECK (color IN ('blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan')),
  icon VARCHAR(50),
  position INT DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fields_team_id ON public.fields(team_id);
CREATE INDEX IF NOT EXISTS idx_fields_created_by ON public.fields(created_by);
CREATE INDEX IF NOT EXISTS idx_fields_is_archived ON public.fields(is_archived);
CREATE INDEX IF NOT EXISTS idx_fields_position ON public.fields(position);

-- ============================================================================
-- 3. UPDATE TASKS TABLE - Add field_id and update status type
-- ============================================================================

ALTER TABLE IF EXISTS public.tasks 
  ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES public.fields(id) ON DELETE SET NULL;

-- Update status column to support custom statuses (change from enum to text)
-- First, we need to drop the old enum constraint if it exists
-- The old constraint is: status task_status NOT NULL DEFAULT 'todo'

-- Backup existing data and recreate status column as text
ALTER TABLE IF EXISTS public.tasks 
  ALTER COLUMN status TYPE VARCHAR(100) USING status::text;

ALTER TABLE IF EXISTS public.tasks 
  ALTER COLUMN status SET DEFAULT 'todo';

CREATE INDEX IF NOT EXISTS idx_tasks_field_id ON public.tasks(field_id);

-- ============================================================================
-- 4. INSERT DEFAULT TASK STATUSES FOR EXISTING TEAMS
-- ============================================================================

-- For each existing team, create default statuses
INSERT INTO public.task_statuses (team_id, name, label, color, position, is_default)
SELECT DISTINCT
  COALESCE(t.id, '00000000-0000-0000-0000-000000000000'::uuid) as team_id,
  status_data.name,
  status_data.label,
  status_data.color,
  status_data.position,
  TRUE
FROM (
  SELECT DISTINCT team_id FROM public.tasks WHERE team_id IS NOT NULL
  UNION
  SELECT id FROM public.teams
) t(team_id),
(VALUES
  ('todo', 'Chưa bắt đầu', 'gray', 0),
  ('in_progress', 'Đang làm', 'blue', 1),
  ('review', 'Chờ duyệt', 'yellow', 2),
  ('done', 'Hoàn thành', 'green', 3)
) as status_data(name, label, color, position)
WHERE t.team_id IS NOT NULL
ON CONFLICT (team_id, name) DO NOTHING;

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE IF EXISTS public.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fields ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES FOR TASK_STATUSES
-- ============================================================================

-- Users can view statuses of their team
CREATE POLICY "Users can view team task statuses" ON public.task_statuses
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can manage task statuses (all users can change them)
CREATE POLICY "Users can manage task statuses in their team" ON public.task_statuses
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 7. RLS POLICIES FOR FIELDS
-- ============================================================================

-- Users can view fields of their team
CREATE POLICY "Users can view team fields" ON public.fields
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can create fields in their team
CREATE POLICY "Users can create fields in their team" ON public.fields
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
  );

-- Users can update and delete their own fields or admins can manage all
CREATE POLICY "Users can manage their fields" ON public.fields
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can delete their fields" ON public.fields
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
