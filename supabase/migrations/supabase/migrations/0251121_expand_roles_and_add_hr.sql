  -- Migration: Expand roles and add HR permissions
  -- Adds new roles (hr, teacher, it, content, design) to app_role ENUM
  -- Updates salaries table RLS policies to include HR role

  -- ============================================================================
  -- 1. EXPAND app_role ENUM WITH NEW ROLES
  -- ============================================================================

  -- Add new role values to the existing app_role ENUM
  -- Note: ALTER TYPE ADD VALUE can only add values, not remove them
  -- If you need to use ALTER TYPE ADD VALUE IF NOT EXISTS, you may need to use a transaction

  ALTER TYPE app_role ADD VALUE 'hr' AFTER 'admin';
  ALTER TYPE app_role ADD VALUE 'teacher';
  ALTER TYPE app_role ADD VALUE 'it';
  ALTER TYPE app_role ADD VALUE 'content';
  ALTER TYPE app_role ADD VALUE 'design';


  -- ============================================================================
  -- 2. UPDATE SALARIES TABLE RLS POLICIES
  -- ============================================================================

  -- Drop existing policies for salaries
  DROP POLICY IF EXISTS "Users can view own salary" ON public.salaries;
  DROP POLICY IF EXISTS "Admins and HR can manage salaries" ON public.salaries;

  -- Create new policies that include HR role permissions

  -- 2.1 SELECT Policy: Users can view their own salary, Admins and HR can view all
  CREATE POLICY "Users can view own salary" ON public.salaries
    FOR SELECT USING (
      auth.uid() = user_id OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

  -- 2.2 ALL Policy: Admins and HR can manage all salaries
  CREATE POLICY "Admins and HR can manage salaries" ON public.salaries
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );


  -- ============================================================================
  -- 3. UPDATE SALARY_COMPLAINTS TABLE RLS POLICIES
  -- ============================================================================

  -- Drop existing policies for salary_complaints
  DROP POLICY IF EXISTS "Users can view own complaints" ON public.salary_complaints;
  DROP POLICY IF EXISTS "Admins and HR can manage complaints" ON public.salary_complaints;

  -- Create new policies that include HR role permissions

  -- 3.1 SELECT Policy: Users can view their own complaints, Admins and HR can view all
  CREATE POLICY "Users can view own complaints" ON public.salary_complaints
    FOR SELECT USING (
      auth.uid() = user_id OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );

  -- 3.2 UPDATE Policy: Admins and HR can manage complaints
  CREATE POLICY "Admins and HR can manage complaints" ON public.salary_complaints
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr'::app_role))
    );