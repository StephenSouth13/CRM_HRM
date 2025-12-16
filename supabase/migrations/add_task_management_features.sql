-- Add fields for task assignment tracking
ALTER TABLE tasks ADD COLUMN assigned_by UUID REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN completed_by UUID REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN completion_notes TEXT;

-- Add indexes for performance
CREATE INDEX idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX idx_tasks_completed_by ON tasks(completed_by);

-- Meeting Room Participants Table (New)
CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES room_bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_organizer BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE,
    google_meet_link TEXT,
    status VARCHAR(20) DEFAULT 'invited',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_room_participants_unique ON room_participants(booking_id, user_id);

-- Enhance Meeting Rooms Table
ALTER TABLE meeting_rooms ADD COLUMN google_meet_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN zoom_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN manager_id UUID REFERENCES auth.users(id);

-- Enhance room bookings
ALTER TABLE room_bookings ADD COLUMN google_meet_link TEXT;
ALTER TABLE room_bookings ADD COLUMN zoom_link TEXT;
ALTER TABLE room_bookings ADD COLUMN organizer_notes TEXT;

-- Comments on tasks
CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task files/attachments
CREATE TABLE task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task history for audit trail
CREATE TABLE task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    change_type VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    field_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Columns/Status Management
CREATE TABLE task_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 0,
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add column_id to tasks
ALTER TABLE tasks ADD COLUMN column_id UUID REFERENCES task_columns(id);

-- New User Registration Dual Approval
-- Enhance user_registrations table
ALTER TABLE user_registrations ADD COLUMN admin_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE user_registrations ADD COLUMN hr_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE user_registrations ADD COLUMN admin_notes TEXT;
ALTER TABLE user_registrations ADD COLUMN hr_notes TEXT;