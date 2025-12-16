-- Migration: Add Leader and Team-based salary RLS policies
-- Purpose: Allow Leaders to view their team's salaries and own salaries

-- Update existing policies to be more granular
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own salary" ON public.salaries;
DROP POLICY IF EXISTS "Admins and HR can manage salaries" ON public.salaries;

-- Policy 1: Users can view their own salary
CREATE POLICY "Users can view own salary" ON public.salaries
    FOR SELECT USING (auth.uid() = user_id);

-- Policy 2: Admin and HR can view all salaries
CREATE POLICY "Admin HR can view all salaries" ON public.salaries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- Policy 3: Leaders can view their team members' salaries
CREATE POLICY "Leaders can view team salaries" ON public.salaries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            INNER JOIN public.profiles leader_profile ON leader_profile.id = auth.uid()
            WHERE t.id = (SELECT team_id FROM public.profiles WHERE id = salaries.user_id)
            AND t.leader_id = auth.uid()
        )
    );

-- Policy 4: Admin and HR can manage (INSERT/UPDATE/DELETE) salaries
CREATE POLICY "Admin HR can manage salaries" ON public.salaries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- Ensure RLS is enabled
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
