-- Create ENUM for report status
CREATE TYPE report_status AS ENUM ('submitted', 'pending_review', 'approved', 'rejected');

-- Create daily_reports table
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  content TEXT NOT NULL,
  tasks_completed UUID[] DEFAULT '{}',
  status report_status DEFAULT 'submitted',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, report_date)
);

-- Create indexes for better query performance
CREATE INDEX idx_daily_reports_user_id ON daily_reports(user_id);
CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date DESC);
CREATE INDEX idx_daily_reports_status ON daily_reports(status);
CREATE INDEX idx_daily_reports_approved_by ON daily_reports(approved_by);

-- Enable RLS
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own reports
CREATE POLICY "Users can view own reports"
  ON daily_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Leaders can see reports from their team members
CREATE POLICY "Leaders can view team reports"
  ON daily_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN teams t ON p1.team_id = t.id
      JOIN profiles p2 ON t.leader_id = p2.id
      WHERE p2.id = auth.uid()
      AND p1.id = daily_reports.user_id
    )
  );

-- RLS Policy: Admin/HR can view all reports
CREATE POLICY "Admin and HR can view all reports"
  ON daily_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'hr')
    )
  );

-- RLS Policy: Users can insert their own reports
CREATE POLICY "Users can insert own reports"
  ON daily_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update own draft reports
CREATE POLICY "Users can update own reports"
  ON daily_reports
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'submitted')
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Leaders/Admin can approve reports
CREATE POLICY "Leaders and admin can approve reports"
  ON daily_reports
  FOR UPDATE
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr')
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM profiles p1
        JOIN teams t ON p1.team_id = t.id
        JOIN profiles p2 ON t.leader_id = p2.id
        WHERE p2.id = auth.uid()
        AND p1.id = daily_reports.user_id
      )
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr')
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM profiles p1
        JOIN teams t ON p1.team_id = t.id
        JOIN profiles p2 ON t.leader_id = p2.id
        WHERE p2.id = auth.uid()
        AND p1.id = daily_reports.user_id
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_reports_updated_at_trigger
BEFORE UPDATE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_daily_reports_updated_at();
