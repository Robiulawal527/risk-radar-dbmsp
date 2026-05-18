-- Admin applications are pending until an existing admin/super-admin approves.

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS nid_number text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS education_field text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.admins ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.id = auth.uid() AND upper(a.status) = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(coalesce(p.role, '')) = 'ADMIN'
  );
$$;

DROP POLICY IF EXISTS admins_select_own ON public.admins;
CREATE POLICY admins_select_own
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS admins_insert_own ON public.admins;
CREATE POLICY admins_insert_own
  ON public.admins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS admins_update_own ON public.admins;
CREATE POLICY admins_update_own
  ON public.admins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());
