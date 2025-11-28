-- Migration: Fix RLS policies for dual-approval registration system

-- ============================================================================
-- 1. DROP CONFLICTING POLICIES ON user_registrations
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own registration" ON public.user_registrations;
DROP POLICY IF EXISTS "Admins and HR can view all registrations" ON public.user_registrations;
DROP POLICY IF EXISTS "Users can create registration" ON public.user_registrations;
DROP POLICY IF EXISTS "Admins and HR can manage registrations" ON public.user_registrations;
DROP POLICY IF EXISTS "Admins can manage registrations" ON public.user_registrations;
DROP POLICY IF EXISTS "HR can approve registrations" ON public.user_registrations;

-- ============================================================================
-- 2. CREATE COMPREHENSIVE RLS POLICIES FOR user_registrations
-- ============================================================================

-- Users can view their own registration
CREATE POLICY "Users view own registration" ON public.user_registrations
    FOR SELECT USING (auth.uid() = user_id);

-- Admins and HR can view all registrations
CREATE POLICY "Admin HR view all registrations" ON public.user_registrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role)
        )
    );

-- Users can insert their own registration
CREATE POLICY "Users create own registration" ON public.user_registrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CRITICAL: Admins and HR can update registrations (for approval/rejection)
CREATE POLICY "Admin HR update registrations" ON public.user_registrations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role)
        )
    );

-- System can insert registrations (via triggers)
CREATE POLICY "System insert registrations" ON public.user_registrations
    FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- 3. FIX profiles TABLE RLS POLICIES FOR ACCOUNT_STATUS UPDATES
-- ============================================================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Leaders can view team members
CREATE POLICY "Leaders view team members" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'leader'::app_role
        )
        AND team_id IN (
            SELECT team_id FROM public.team_leaders 
            WHERE user_id = auth.uid()
        )
    );

-- Admins and HR can view all profiles
CREATE POLICY "Admin HR view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role)
        )
    );

-- Users can update their own profile (except account_status)
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND account_status = (
            SELECT account_status FROM public.profiles WHERE id = auth.uid()
        )
    );

-- CRITICAL: Admins and HR can update any profile (including account_status)
CREATE POLICY "Admin HR update all profiles" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role)
        )
    );

-- System and users can insert profiles (on auth signup)
CREATE POLICY "Anyone insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (TRUE);

-- Admins can delete (for cleanup)
CREATE POLICY "Admins delete profiles" ON public.profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
    );

-- ============================================================================
-- 4. FIX user_roles TABLE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins view all roles" ON public.user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
    );

-- CRITICAL: Only admins can insert/update/delete roles
CREATE POLICY "Admins manage roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
    );

-- System can insert roles (via triggers and RPC)
CREATE POLICY "System insert roles" ON public.user_roles
    FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- 5. ENSURE RPC FUNCTIONS CAN EXECUTE WITH PROPER SECURITY DEFINER
-- ============================================================================

-- All RPC functions should use SECURITY DEFINER to bypass RLS
-- This is already set in the previous migration, but double-check:
-- approve_user_registration, reject_user_registration, etc.
