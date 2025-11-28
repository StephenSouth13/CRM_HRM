-- Migration: Extend tasks table with scheduling fields

-- ============================================================================
-- 1. ADD NEW COLUMNS TO tasks TABLE
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8, 2);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(8, 2);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress_percentage INT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS dependencies UUID[] DEFAULT ARRAY[]::UUID[];

-- ============================================================================
-- 2. CREATE INDEX FOR TASK SCHEDULING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);

-- ============================================================================
-- 3. ADD TRIGGER FOR UPDATING PROGRESS_PERCENTAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_task_progress_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update progress percentage based on status
    IF NEW.status = 'done' THEN
        NEW.progress_percentage := 100;
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at := NOW();
        END IF;
    ELSIF NEW.status = 'review' THEN
        NEW.progress_percentage := 80;
    ELSIF NEW.status = 'in_progress' THEN
        IF NEW.progress_percentage < 20 THEN
            NEW.progress_percentage := 20;
        END IF;
    ELSIF NEW.status = 'todo' THEN
        IF NEW.progress_percentage > 0 THEN
            NEW.progress_percentage := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_progress_on_status_change ON public.tasks;
CREATE TRIGGER task_progress_on_status_change BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_progress_on_status_change();
