
-- Add a second leader to the teams table
ALTER TABLE public.teams
ADD COLUMN leader_2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Optional: Add a check to prevent the same leader from being assigned twice
ALTER TABLE public.teams
ADD CONSTRAINT check_distinct_leaders CHECK (leader_id <> leader_2_id);

-- Update RLS policies for teams if they exist, or create them.
-- For now, let's assume admins can manage teams.
-- We will handle more granular leader-based policies later if needed.

-- Drop existing policies to redefine them
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."teams";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."teams";
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON "public"."teams";
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON "public"."teams";
DROP POLICY IF EXISTS "Admins can do everything" ON "public"."teams";
DROP POLICY IF EXISTS "Leaders can manage their own team" ON "public"."teams";
DROP POLICY IF EXISTS "Members can view their own team" ON "public"."teams";


-- Create new policies
CREATE POLICY "Admins can do everything"
ON public.teams
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Leaders can manage their own team"
ON public.teams
FOR ALL
USING (
  (
    auth.uid() = leader_id OR auth.uid() = leader_2_id
  ) AND public.is_leader(auth.uid())
)
WITH CHECK (
  (
    auth.uid() = leader_id OR auth.uid() = leader_2_id
  ) AND public.is_leader(auth.uid())
);

CREATE POLICY "Members can view their own team"
ON public.teams
FOR SELECT
USING (
  id = (
    SELECT team_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;