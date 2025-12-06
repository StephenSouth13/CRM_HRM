# Database Schema Guide for Task and Meeting Room Features

## Quick SQL Commands for Critical Tables

### 1. Enhance Tasks Table (Existing)
```sql
-- Add fields for task assignment tracking
ALTER TABLE tasks ADD COLUMN assigned_by UUID REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN completed_by UUID REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN completion_notes TEXT;

-- Add indexes for performance
CREATE INDEX idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX idx_tasks_completed_by ON tasks(completed_by);
```

### 2. Meeting Room Participants Table (New)
```sql
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
```

### 3. Enhance Meeting Rooms Table
```sql
ALTER TABLE meeting_rooms ADD COLUMN google_meet_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN zoom_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE meeting_rooms ADD COLUMN manager_id UUID REFERENCES auth.users(id);

-- Enhance room bookings
ALTER TABLE room_bookings ADD COLUMN google_meet_link TEXT;
ALTER TABLE room_bookings ADD COLUMN zoom_link TEXT;
ALTER TABLE room_bookings ADD COLUMN organizer_notes TEXT;
```

### 4. Task Management Tables
```sql
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
```

### 5. Task Columns/Status Management
```sql
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
```

### 6. New User Registration Dual Approval
```sql
-- Enhance user_registrations table
ALTER TABLE user_registrations ADD COLUMN admin_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE user_registrations ADD COLUMN hr_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE user_registrations ADD COLUMN admin_notes TEXT;
ALTER TABLE user_registrations ADD COLUMN hr_notes TEXT;
```

## Key Features Implemented

### 1. Task Assignment Tracking
- **assigned_by**: Track who assigned the task
- **completed_by**: Track who completed the task
- **completion_notes**: Notes from the person who completed the task

### 2. Meeting Room Participants
- **room_participants** table tracks who is invited to/attending a meeting
- **is_organizer** flag to distinguish the meeting organizer
- **status**: Can be 'invited', 'accepted', 'declined', 'joined'
- **google_meet_link**: Support for Google Meet integration
- **joined_at**: Timestamp when participant actually joined

### 3. Task Management
- **Comments**: Discuss tasks with team members
- **Attachments**: Upload files to tasks
- **History**: Audit trail of all changes to tasks
- **Labels/Tags**: Categorize tasks

### 4. Kanban Board Columns
- **task_columns**: Manage custom columns on the board
- Each task can belong to a specific column
- Columns can have custom names, colors, and positions

### 5. Enhanced User Registration
- Dual approval system: Admin AND HR must approve
- Separate tracking for admin and HR approvals
- Notes from each approver for transparency

## Row Level Security (RLS) Policies Included

All tables include RLS policies to ensure:
- Users can only see data related to their team
- Only authorized users can modify data
- Comments and attachments are team-scoped

## Implementation Notes

1. All migration SQL is provided in `supabase/migrations/add_task_management_features.sql`
2. Run migrations through Supabase dashboard or CLI
3. RLS policies are automatically created with the migration
4. All tables include proper indexes for performance
5. Timestamps are managed with automatic `updated_at` triggers

## Frontend Integration Steps

1. Update KanbanBoard to support custom columns
2. Add ParticipantsList component for meeting rooms
3. Create RoomParticipantDialog for adding/managing participants
4. Add Google Meet link generation functionality
5. Update TaskCard to show assigned_by information
6. Add task comments and attachments sections
