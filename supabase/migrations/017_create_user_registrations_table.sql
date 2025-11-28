-- Migration: Create user_registrations table for approval workflow

-- ============================================================================
-- 1. CREATE user_registrations TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(20),
    department VARCHAR(100),
    employment_status VARCHAR(50),
    cv_url TEXT,
    requested_role VARCHAR(50) DEFAULT 'staff',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reapplication_count INT DEFAULT 0,
    last_rejection_date TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_registrations_user_id ON public.user_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_registrations_email ON public.user_registrations(email);
CREATE INDEX IF NOT EXISTS idx_user_registrations_status ON public.user_registrations(status);
CREATE INDEX IF NOT EXISTS idx_user_registrations_created_at ON public.user_registrations(created_at DESC);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.user_registrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE RLS POLICIES
-- ============================================================================

-- Users can view their own registration
CREATE POLICY "Users can view own registration" ON public.user_registrations
    FOR SELECT USING (auth.uid() = user_id);

-- Admins and HR can view all registrations
CREATE POLICY "Admins and HR can view all registrations" ON public.user_registrations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- Users can create registration requests
CREATE POLICY "Users can create registration" ON public.user_registrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and HR can manage all registrations
CREATE POLICY "Admins and HR can manage registrations" ON public.user_registrations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

-- ============================================================================
-- 4. CREATE FUNCTION TO AUTO-CREATE REGISTRATION ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Create registration record when profile is created
    INSERT INTO public.user_registrations (
        user_id, email, first_name, last_name, phone, department, 
        employment_status, cv_url, requested_role, status
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.first_name,
        NEW.last_name,
        NEW.phone,
        'Unspecified',
        NEW.employment_status,
        NEW.cv_url,
        'staff',
        'pending'
    )
    ON CONFLICT (email) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_registration_on_profile_insert ON public.profiles;

-- Create trigger
CREATE TRIGGER create_registration_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION create_user_registration();

-- ============================================================================
-- 5. CREATE FUNCTION TO APPROVE REGISTRATION AND SET ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_user_registration(
    p_registration_id UUID,
    p_role VARCHAR(50),
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_email VARCHAR(255);
    v_result JSON;
BEGIN
    -- Get user_id from registration
    SELECT user_id, email INTO v_user_id, v_email
    FROM public.user_registrations
    WHERE id = p_registration_id;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Registration not found');
    END IF;
    
    -- Update registration status
    UPDATE public.user_registrations
    SET 
        status = 'approved',
        requested_role = p_role,
        admin_notes = p_admin_notes,
        approved_at = NOW(),
        approved_by = auth.uid()
    WHERE id = p_registration_id;
    
    -- Upsert user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role::app_role)
    ON CONFLICT (user_id) DO UPDATE SET role = p_role::app_role;
    
    RETURN json_build_object(
        'success', true, 
        'message', 'User approved successfully',
        'user_id', v_user_id,
        'email', v_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. CREATE FUNCTION TO REJECT REGISTRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_user_registration(
    p_registration_id UUID,
    p_rejection_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_email VARCHAR(255);
BEGIN
    -- Get user_id from registration
    SELECT user_id, email INTO v_user_id, v_email
    FROM public.user_registrations
    WHERE id = p_registration_id;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Registration not found');
    END IF;
    
    -- Update registration status
    UPDATE public.user_registrations
    SET 
        status = 'rejected',
        rejection_reason = p_rejection_reason,
        last_rejection_date = NOW(),
        reapplication_count = reapplication_count + 1
    WHERE id = p_registration_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'User rejected successfully',
        'user_id', v_user_id,
        'email', v_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. CREATE VIEW FOR ADMIN DASHBOARD
-- ============================================================================

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
    ur.created_at,
    ur.approved_at,
    ur.reapplication_count
FROM public.user_registrations ur
WHERE ur.status = 'pending'
ORDER BY ur.created_at ASC;

-- ============================================================================
-- 8. CREATE TRIGGER FOR UPDATED_AT (if needed for future updates)
-- ============================================================================

ALTER TABLE public.user_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_user_registrations_updated_at ON public.user_registrations;

CREATE TRIGGER update_user_registrations_updated_at BEFORE UPDATE ON public.user_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
