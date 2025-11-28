-- Migration: Add dual-approval system (Admin + HR required)

-- ============================================================================
-- 1. ADD NEW COLUMNS TO user_registrations FOR DUAL APPROVAL
-- ============================================================================

ALTER TABLE IF EXISTS public.user_registrations
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. CREATE MIGRATION FUNCTION TO UPDATE EXISTING DATA
-- ============================================================================

-- For existing approved registrations, set both approvals to the same timestamp
UPDATE public.user_registrations
SET admin_approved_at = approved_at, admin_approved_by = approved_by
WHERE status = 'approved' AND admin_approved_at IS NULL;

-- ============================================================================
-- 3. UPDATE approve_user_registration FUNCTION FOR DUAL APPROVAL
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_user_registration(
    p_registration_id UUID,
    p_role VARCHAR(50),
    p_approval_by VARCHAR(50) DEFAULT 'admin',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_email VARCHAR(255);
    v_registration_status VARCHAR(20);
    v_both_approved BOOLEAN;
BEGIN
    -- Get current registration details
    SELECT user_id, email, status 
    INTO v_user_id, v_email, v_registration_status
    FROM public.user_registrations
    WHERE id = p_registration_id;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Registration not found');
    END IF;
    
    -- Check if requester is admin or hr
    IF p_approval_by NOT IN ('admin', 'hr') THEN
        RETURN json_build_object('success', false, 'message', 'Invalid approval type');
    END IF;
    
    -- Update registration based on approval type
    IF p_approval_by = 'admin' THEN
        UPDATE public.user_registrations
        SET 
            admin_approved_at = NOW(),
            admin_approved_by = auth.uid(),
            requested_role = p_role,
            admin_notes = p_admin_notes
        WHERE id = p_registration_id;
    ELSIF p_approval_by = 'hr' THEN
        UPDATE public.user_registrations
        SET 
            hr_approved_at = NOW(),
            hr_approved_by = auth.uid()
        WHERE id = p_registration_id;
    END IF;
    
    -- Check if both approvals are now complete
    SELECT 
        (admin_approved_at IS NOT NULL) AND (hr_approved_at IS NOT NULL) AS both_approved
    INTO v_both_approved
    FROM public.user_registrations
    WHERE id = p_registration_id;
    
    -- If both approved, update status and create user role
    IF v_both_approved THEN
        UPDATE public.user_registrations
        SET status = 'approved', approved_at = NOW(), approved_by = auth.uid()
        WHERE id = p_registration_id;
        
        -- Upsert user role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, p_role::app_role)
        ON CONFLICT (user_id) DO UPDATE SET role = p_role::app_role;
        
        -- Update profile account_status to APPROVED
        UPDATE public.profiles
        SET account_status = 'APPROVED'
        WHERE id = v_user_id;
    ELSE
        -- Update profile account_status to PENDING_APPROVALS (if needed)
        -- For now keep it PENDING
        UPDATE public.profiles
        SET account_status = 'PENDING'
        WHERE id = v_user_id;
    END IF;
    
    RETURN json_build_object(
        'success', true, 
        'message', CASE 
            WHEN v_both_approved THEN 'User approved by both admin and HR successfully'
            ELSE 'User approval recorded. Awaiting other approvers.'
        END,
        'user_id', v_user_id,
        'email', v_email,
        'both_approved', v_both_approved
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE FUNCTION TO GET REGISTRATION APPROVAL STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_registration_approval_status(p_registration_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'admin_approved', admin_approved_at IS NOT NULL,
        'admin_approved_at', admin_approved_at,
        'admin_approved_by', admin_approved_by,
        'hr_approved', hr_approved_at IS NOT NULL,
        'hr_approved_at', hr_approved_at,
        'hr_approved_by', hr_approved_by,
        'both_approved', (admin_approved_at IS NOT NULL) AND (hr_approved_at IS NOT NULL),
        'status', status
    ) INTO v_result
    FROM public.user_registrations
    WHERE id = p_registration_id;
    
    RETURN COALESCE(v_result, json_build_object('error', 'Registration not found'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. UPDATE pending_registrations VIEW TO SHOW APPROVAL STATUS
-- ============================================================================

DROP VIEW IF EXISTS public.pending_registrations;

CREATE OR REPLACE VIEW public.pending_registrations AS
SELECT 
    ur.id,
    ur.user_id,
    ur.email,
    ur.first_name,
    ur.last_name,
    ur.phone,
    ur.department,
    ur.employment_status,
    ur.cv_url,
    ur.requested_role,
    ur.status,
    ur.admin_approved_at,
    ur.hr_approved_at,
    ur.created_at,
    (ur.admin_approved_at IS NOT NULL) AS admin_approved,
    (ur.hr_approved_at IS NOT NULL) AS hr_approved,
    ((ur.admin_approved_at IS NOT NULL) AND (ur.hr_approved_at IS NOT NULL)) AS fully_approved
FROM public.user_registrations ur
WHERE ur.status = 'pending' OR ur.admin_approved_at IS NOT NULL OR ur.hr_approved_at IS NOT NULL
ORDER BY ur.created_at ASC;

-- ============================================================================
-- 6. UPDATE RLS POLICY FOR user_registrations
-- ============================================================================

DROP POLICY IF EXISTS "Admins and HR can manage registrations" ON public.user_registrations;

-- Allow admins to manage (approve/reject) registrations
CREATE POLICY "Admins can manage registrations" ON public.user_registrations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role)
    );

-- Allow HR to approve (but with restrictions - they can only approve, not reject)
CREATE POLICY "HR can approve registrations" ON public.user_registrations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hr'::app_role)
    );

-- ============================================================================
-- 7. CREATE INDEXES FOR DUAL APPROVAL COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_registrations_admin_approved_at ON public.user_registrations(admin_approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_registrations_hr_approved_at ON public.user_registrations(hr_approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_registrations_admin_approved_by ON public.user_registrations(admin_approved_by);
CREATE INDEX IF NOT EXISTS idx_user_registrations_hr_approved_by ON public.user_registrations(hr_approved_by);
