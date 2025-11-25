-- Create ENUM for meeting status
CREATE TYPE meeting_status AS ENUM ('draft', 'completed', 'archived');

-- Create meeting_minutes table
CREATE TABLE meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  attendees UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status meeting_status DEFAULT 'draft',
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_meeting_minutes_created_by ON meeting_minutes(created_by);
CREATE INDEX idx_meeting_minutes_meeting_date ON meeting_minutes(meeting_date DESC);
CREATE INDEX idx_meeting_minutes_status ON meeting_minutes(status);

-- Enable RLS
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Creator can view/edit their own meeting minutes
CREATE POLICY "Users can view own meeting minutes"
  ON meeting_minutes
  FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = ANY(attendees));

-- RLS Policy: Admin/HR can view all meeting minutes
CREATE POLICY "Admin and HR can view all meeting minutes"
  ON meeting_minutes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'hr')
    )
  );

-- RLS Policy: Users can insert meeting minutes
CREATE POLICY "Users can create meeting minutes"
  ON meeting_minutes
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Creator and Admin can update meeting minutes
CREATE POLICY "Creator and admin can update meeting minutes"
  ON meeting_minutes
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'hr')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_meeting_minutes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meeting_minutes_updated_at_trigger
BEFORE UPDATE ON meeting_minutes
FOR EACH ROW
EXECUTE FUNCTION update_meeting_minutes_updated_at();
