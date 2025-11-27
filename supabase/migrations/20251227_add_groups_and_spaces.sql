-- Migration: Add Groups and Spaces for Task Management

-- ============================================================================
-- 1. CREATE GROUPS TABLE (Team Groups)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT 'blue' CHECK (color IN ('blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan')),
  leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_groups UNIQUE (team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_groups_team_id ON public.groups(team_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON public.groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON public.groups(is_active);
CREATE INDEX IF NOT EXISTS idx_groups_position ON public.groups(position);

-- ============================================================================
-- 2. CREATE SPACES TABLE (Spaces within Groups)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT 'cyan' CHECK (color IN ('blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan')),
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_spaces UNIQUE (group_id, name)
);

CREATE INDEX IF NOT EXISTS idx_spaces_group_id ON public.spaces(group_id);
CREATE INDEX IF NOT EXISTS idx_spaces_team_id ON public.spaces(team_id);
CREATE INDEX IF NOT EXISTS idx_spaces_is_active ON public.spaces(is_active);
CREATE INDEX IF NOT EXISTS idx_spaces_position ON public.spaces(position);

-- ============================================================================
-- 3. CREATE GROUP_MEMBERS TABLE (Track which users are in which groups)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- 'leader', 'member', 'observer'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_members UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- ============================================================================
-- 4. UPDATE TASKS TABLE - Add group_id and space_id
-- ============================================================================

ALTER TABLE IF EXISTS public.tasks 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.tasks 
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_id ON public.tasks(space_id);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES FOR GROUPS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view team groups" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups in their team" ON public.groups;
DROP POLICY IF EXISTS "Users can manage groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete groups" ON public.groups;

-- Users can view groups of their team
CREATE POLICY "Users can view team groups" ON public.groups
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can create groups in their team (leaders and admins)
CREATE POLICY "Users can create groups in their team" ON public.groups
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader')
    )
  );

-- Users can update and delete groups in their team
CREATE POLICY "Users can manage groups in their team" ON public.groups
  FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can delete groups in their team" ON public.groups
  FOR DELETE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 7. RLS POLICIES FOR SPACES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view team spaces" ON public.spaces;
DROP POLICY IF EXISTS "Users can create spaces in their team" ON public.spaces;
DROP POLICY IF EXISTS "Users can manage spaces" ON public.spaces;
DROP POLICY IF EXISTS "Users can delete spaces" ON public.spaces;

-- Users can view spaces of their team
CREATE POLICY "Users can view team spaces" ON public.spaces
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can create spaces in their team
CREATE POLICY "Users can create spaces in their team" ON public.spaces
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_id 
      AND team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Users can update and delete spaces in their team
CREATE POLICY "Users can manage spaces in their team" ON public.spaces
  FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can delete spaces in their team" ON public.spaces
  FOR DELETE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 8. RLS POLICIES FOR GROUP_MEMBERS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can manage group members" ON public.group_members;

-- Users can view group members of their team's groups
CREATE POLICY "Users can view group members" ON public.group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_id 
      AND team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can manage group members (group leaders and admins)
CREATE POLICY "Users can manage group members" ON public.group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_id 
      AND (leader_id = auth.uid() OR team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()))
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 9. CREATE DEFAULT GROUP FOR EACH TEAM (if not exists)
-- ============================================================================

INSERT INTO public.groups (team_id, name, description, color, position, is_active)
SELECT DISTINCT
  id as team_id,
  'Default Group' as name,
  'Default group for team' as description,
  'blue' as color,
  0 as position,
  TRUE as is_active
FROM public.teams
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups WHERE team_id = teams.id
)
ON CONFLICT (team_id, name) DO NOTHING;

-- Create default spaces for each default group
INSERT INTO public.spaces (group_id, team_id, name, description, color, position, is_active)
SELECT DISTINCT
  g.id as group_id,
  g.team_id,
  'Default Space' as name,
  'Default space for group' as description,
  'cyan' as color,
  0 as position,
  TRUE as is_active
FROM public.groups g
WHERE g.name = 'Default Group'
AND NOT EXISTS (
  SELECT 1 FROM public.spaces WHERE group_id = g.id
)
ON CONFLICT (group_id, name) DO NOTHING;
