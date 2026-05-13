-- Create/normalize a Supabase-backed `profiles` table and keep it in sync with auth.users.
-- Apply with: psql "$DATABASE_URL" -f packages/database/migrations/002_profile.sql

-- 1) Table (many Supabase starters already create `public.profiles`)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Normalize/extend columns (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep email unique when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_unique'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- 2) RLS (safe defaults for public client usage)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users can read their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;

  -- Users can insert their own profile row (usually created by trigger, but keep for completeness)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  -- Users can update their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 3) Trigger to auto-create/update profile on auth.users changes
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name text;
BEGIN
  display_name :=
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'User'
    );

  INSERT INTO public.profiles (id, email, full_name, phone, avatar, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    display_name,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar', ''),
    COALESCE(NULLIF(NEW.raw_app_meta_data->>'role', ''), 'USER'),
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

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_profile_sync'
  ) THEN
    CREATE TRIGGER on_auth_user_profile_sync
      AFTER INSERT OR UPDATE OF email, raw_user_meta_data, raw_app_meta_data
      ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_auth_user_profile();
  END IF;
END $$;

-- 4) Fix common starter trigger that inserts into `profiles(name, ...)`
-- (Many templates ship `handle_new_user()` that references a `name` column.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data->>'name', ''), 'USER')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

