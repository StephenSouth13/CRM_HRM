-- ============================================================================
-- MIGRATION: Add RLS Policies for Tasks Table
-- ============================================================================

-- Ensure RLS is enabled on the tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR TASKS
-- ============================================================================

-- 1. SELECT: Users can view tasks in their team or if they are assigned
DROP POLICY IF EXISTS "Users can view team tasks" ON public.tasks;
CREATE POLICY "Users can view team tasks"
    ON public.tasks FOR SELECT
    USING (
        -- User is in the task's team
        team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
        -- OR user is assigned to the task
        OR assigned_to = auth.uid()
        -- OR user is the creator
        OR created_by = auth.uid()
        -- OR user is admin
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 2. INSERT: Users can create tasks in their team, or admins can create anywhere
DROP POLICY IF EXISTS "Users can create tasks in their team" ON public.tasks;
CREATE POLICY "Users can create tasks in their team"
    ON public.tasks FOR INSERT
    WITH CHECK (
        -- User is in the task's team
        team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
        -- OR user is admin
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 3. UPDATE: Users can update tasks they created or are assigned to, or team leads/admins
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
CREATE POLICY "Users can update their tasks"
    ON public.tasks FOR UPDATE
    USING (
        -- User is the creator
        created_by = auth.uid()
        -- OR user is assigned to the task
        OR assigned_to = auth.uid()
        -- OR user is team lead
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.team_id = tasks.team_id
            AND p.role = 'leader'
        )
        -- OR user is admin
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 4. DELETE: Only creators, team leads, or admins can delete tasks
DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;
CREATE POLICY "Users can delete their tasks"
    ON public.tasks FOR DELETE
    USING (
        -- User is the creator
        created_by = auth.uid()
        -- OR user is team lead
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.team_id = tasks.team_id
            AND p.role = 'leader'
        )
        -- OR user is admin
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- ============================================================================
-- RLS POLICIES FOR TASK_COLUMNS (Kanban columns)
-- ============================================================================

-- Ensure RLS is enabled on task_columns table
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can view columns in their team
DROP POLICY IF EXISTS "Users can view team columns" ON public.task_columns;
CREATE POLICY "Users can view team columns"
    ON public.task_columns FOR SELECT
    USING (
        team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 2. INSERT: Users can create columns in their team
DROP POLICY IF EXISTS "Users can create columns in their team" ON public.task_columns;
CREATE POLICY "Users can create columns in their team"
    ON public.task_columns FOR INSERT
    WITH CHECK (
        team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 3. UPDATE: Team leads and admins can update columns
DROP POLICY IF EXISTS "Team leads can update columns" ON public.task_columns;
CREATE POLICY "Team leads can update columns"
    ON public.task_columns FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.team_id = task_columns.team_id
            AND (p.role = 'leader' OR p.role = 'admin')
        )
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- 4. DELETE: Team leads and admins can delete columns
DROP POLICY IF EXISTS "Team leads can delete columns" ON public.task_columns;
CREATE POLICY "Team leads can delete columns"
    ON public.task_columns FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.team_id = task_columns.team_id
            AND (p.role = 'leader' OR p.role = 'admin')
        )
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================