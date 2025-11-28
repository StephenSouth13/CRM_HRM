-- Migration: Create Board Structure - Fields as Columns, Tasks as Items

-- ============================================================================
-- 1. CREATE FIELDS TABLE (Columns/Sections)
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
CREATE INDEX IF NOT EXISTS idx_fields_position ON public.fields(position);

-- ============================================================================
-- 2. UPDATE TASKS TABLE - Add field_id (Field/Column reference)
-- ============================================================================

ALTER TABLE IF EXISTS public.tasks 
  ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES public.fields(id) ON DELETE SET NULL;

-- Keep existing status column for reference (if needed for backward compatibility)
-- but primary organization is now by field_id

CREATE INDEX IF NOT EXISTS idx_tasks_field_id ON public.tasks(field_id);

-- ============================================================================
-- 3. INSERT DEFAULT FIELDS FOR EACH TEAM
-- ============================================================================

-- Function to insert default fields for a team
CREATE OR REPLACE FUNCTION create_default_fields_for_team(p_team_id UUID)
RETURNS void AS $$
DECLARE
  default_field_data RECORD;
BEGIN
  -- Insert default fields if they don't exist
  INSERT INTO public.fields (team_id, created_by, name, color, position, is_archived)
  SELECT 
    p_team_id,
    p.id,  -- First user in the team (or any default)
    field_config.name,
    field_config.color,
    field_config.position,
    FALSE
  FROM (SELECT id FROM public.profiles WHERE team_id = p_team_id LIMIT 1) p,
  (VALUES
    ('To Do', 'gray', 0),
    ('Doing', 'blue', 1),
    ('Review', 'yellow', 2),
    ('Done', 'green', 3)
  ) field_config(name, color, position)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fields WHERE team_id = p_team_id AND name = field_config.name
  );
END;
$$ LANGUAGE plpgsql;

-- Insert default fields for all existing teams
DO $$
DECLARE
  team_rec RECORD;
BEGIN
  FOR team_rec IN SELECT id FROM public.teams
  LOOP
    PERFORM create_default_fields_for_team(team_rec.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE IF EXISTS public.fields ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES FOR FIELDS
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

-- Allow tasks to be filtered by field_id
CREATE POLICY "Users can view tasks in their team fields" ON public.tasks
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
