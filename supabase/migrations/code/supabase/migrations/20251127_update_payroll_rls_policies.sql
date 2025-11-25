-- Migration: Update Salaries RLS Policies - "Own Data First" with Team-Based Access
-- Purpose: Implement 3-policy RLS system for salaries:
--   Policy 1 (Own Data): Users can see their own salaries
--   Policy 2 (Admin/HR): Admin and HR can see all salaries and perform CRUD
--   Policy 3 (Team/Leader): Leaders can see salaries of their team members

-- ============================================================================
-- 1. DROP OLD POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own salary" ON public.salaries;
DROP POLICY IF EXISTS "Admins and HR can manage salaries" ON public.salaries;

-- ============================================================================
-- 2. CREATE NEW POLICIES WITH "OWN DATA FIRST" + TEAM + ADMIN/HR ACCESS
-- ============================================================================

-- POLICY 1: Own Data - Users can see their own salary
CREATE POLICY "Users can view own salary" ON public.salaries
  FOR SELECT USING (auth.uid() = user_id);

-- POLICY 2: Admin/HR Full Access - Full CRUD for admin and hr roles
CREATE POLICY "Admins and HR can manage salaries" ON public.salaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
  );

-- POLICY 3: Leaders can view their team members' salaries (SELECT only)
-- This requires a join with team_leaders table to check if the current user is a leader of the target user's team
CREATE POLICY "Leaders can view team member salaries" ON public.salaries
  FOR SELECT USING (
    -- Check if current user is a leader of the team where user_id belongs
    EXISTS (
      SELECT 1 FROM public.team_leaders tl
      INNER JOIN public.profiles p ON p.id = user_id
      WHERE tl.user_id = auth.uid() AND tl.team_id = p.team_id
    )
  );

-- ============================================================================
-- 3. OPTIONAL: Create a view for easier role-based payroll access
-- ============================================================================

-- View: user_payroll_access - Shows which users can access which salaries
CREATE OR REPLACE VIEW public.user_payroll_access AS
SELECT 
  s.id AS salary_id,
  s.user_id,
  s.base_salary,
  s.allowances,
  s.bonus,
  s.deductions,
  s.tax_amount,
  s.net_salary,
  s.pay_period_start,
  s.pay_period_end,
  s.payment_status,
  p.full_name,
  p.email,
  p.team_id,
  t.name AS team_name
FROM public.salaries s
LEFT JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.teams t ON p.team_id = t.id;

-- ============================================================================
-- Note: RLS is already enabled on public.salaries from migration 20251120
-- ============================================================================
