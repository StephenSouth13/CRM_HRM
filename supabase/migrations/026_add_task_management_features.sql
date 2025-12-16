-- ============================================================================
-- MIGRATION: Add Task Management and Meeting Room Features
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE TASKS TABLE - Add assigned_by field
-- ============================================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_id ON tasks(space_id);

-- ============================================================================
-- 2. CREATE TASK COMMENTS TABLE - For task discussions
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);

-- ============================================================================
-- 3. CREATE TASK ATTACHMENTS TABLE - For file uploads to tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- ============================================================================
-- 4. ENHANCE MEETING ROOMS - Add participants tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES room_bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'invited',
    google_meet_link TEXT,
    is_organizer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_participants_unique ON room_participants(booking_id, user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_booking_id ON room_participants(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_status ON room_participants(status);

-- ============================================================================
-- 5. ENHANCE MEETING ROOMS TABLE - Add meeting links and settings
-- ============================================================================
ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS google_meet_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS zoom_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS has_whiteboard BOOLEAN DEFAULT TRUE;
ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_rooms_manager_id ON meeting_rooms(manager_id);

-- ============================================================================
-- 6. ENHANCE ROOM BOOKINGS TABLE - Add meeting link tracking
-- ============================================================================
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS zoom_link TEXT;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS organizer_notes TEXT;
ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS attendance_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_room_bookings_user_id ON room_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_room_id ON room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_status ON room_bookings(status);



-- ============================================================================
-- 8. CREATE TASK HISTORY TABLE - Audit trail for task changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    field_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_changed_by ON task_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at);

-- ============================================================================
-- 9. CREATE TASK LABELS/TAGS TABLE - For task categorization
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_name VARCHAR(100) NOT NULL,
    label_color VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_labels_task_id ON task_labels(task_id);
CREATE INDEX IF NOT EXISTS idx_task_labels_name ON task_labels(label_name);

-- ============================================================================
-- 10. ENHANCE USER REGISTRATIONS - For dual approval system
-- ============================================================================
ALTER TABLE user_registrations ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_registrations ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_registrations ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
ALTER TABLE user_registrations ADD COLUMN IF NOT EXISTS reapplication_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_user_registrations_status ON user_registrations(status);
CREATE INDEX IF NOT EXISTS idx_user_registrations_admin_approved_at ON user_registrations(admin_approved_at);
CREATE INDEX IF NOT EXISTS idx_user_registrations_hr_approved_at ON user_registrations(hr_approved_at);

-- ============================================================================
-- 11. CREATE NOTIFICATION PREFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email_new_tasks BOOLEAN DEFAULT TRUE,
    email_task_updates BOOLEAN DEFAULT TRUE,
    email_approvals BOOLEAN DEFAULT TRUE,
    email_room_bookings BOOLEAN DEFAULT TRUE,
    push_new_tasks BOOLEAN DEFAULT TRUE,
    push_task_updates BOOLEAN DEFAULT TRUE,
    push_approvals BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ============================================================================
-- 12. COLUMN MANAGEMENT - For Kanban board columns
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_columns_team_id ON task_columns(team_id);
CREATE INDEX IF NOT EXISTS idx_task_columns_position ON task_columns(position);

-- Add column_id to tasks table if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES task_columns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);

-- ============================================================================
-- 13. CREATE TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tables with updated_at


DROP TRIGGER IF EXISTS update_task_columns_timestamp ON task_columns;
CREATE TRIGGER update_task_columns_timestamp
    BEFORE UPDATE ON task_columns
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_notification_preferences_timestamp ON notification_preferences;
CREATE TRIGGER update_notification_preferences_timestamp
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 14. ENABLE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Task Comments RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view comments on their team tasks" ON task_comments;
CREATE POLICY "Users can view comments on their team tasks"
    ON task_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_comments.task_id
            AND t.team_id IN (
                SELECT team_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Room Participants RLS
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their room bookings participants" ON room_participants;
CREATE POLICY "Users can view their room bookings participants"
    ON room_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM room_bookings rb
            WHERE rb.id = room_participants.booking_id
            AND (rb.user_id = auth.uid() OR room_participants.user_id = auth.uid())
        )
    );

-- Task Attachments RLS
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view attachments on their team tasks" ON task_attachments;
CREATE POLICY "Users can view attachments on their team tasks"
    ON task_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_attachments.task_id
            AND t.team_id IN (
                SELECT team_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================