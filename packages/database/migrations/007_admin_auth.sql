-- Admin auth support for web signup/login.
-- Creates an admins registry and keeps profile role in sync for users who choose admin signup.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy Express/Postgres table shape for non-Supabase deployments.
CREATE TABLE IF NOT EXISTS admins (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_select_own ON public.admins;
CREATE POLICY admins_select_own
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

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
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name text;
  requested_role text;
BEGIN
  display_name :=
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'User'
    );

  requested_role := upper(COALESCE(
    NULLIF(NEW.raw_app_meta_data->>'role', ''),
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    'USER'
  ));

  IF requested_role NOT IN ('USER', 'ADMIN') THEN
    requested_role := 'USER';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, avatar, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    display_name,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar', ''),
    requested_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        avatar = EXCLUDED.avatar,
        role = EXCLUDED.role,
        updated_at = now();

  IF requested_role = 'ADMIN' THEN
    INSERT INTO public.admins (id, email, name, status, created_at, updated_at)
    VALUES (NEW.id, NEW.email, display_name, 'ACTIVE', now(), now())
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          name = EXCLUDED.name,
          status = 'ACTIVE',
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.id = auth.uid() AND upper(a.status) = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(coalesce(p.role, '')) = 'ADMIN'
  );
$$;
