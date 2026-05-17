-- Admin-managed ranking tables and policies for web/mobile shared visibility.
-- Apply in Supabase SQL editor after 005_public_crimes_sos_realtime.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.criminal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer,
  gender text,
  description text NOT NULL DEFAULT '',
  known_aliases text[] NOT NULL DEFAULT '{}',
  photo_url text,
  status text NOT NULL DEFAULT 'UNDER_REVIEW',
  crime_count integer NOT NULL DEFAULT 0,
  intensity double precision NOT NULL DEFAULT 1,
  most_frequent_crime text NOT NULL DEFAULT 'OTHER',
  score double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  avatar text,
  skills text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ACTIVE',
  activity_count integer NOT NULL DEFAULT 0,
  intensity double precision NOT NULL DEFAULT 1,
  score double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_criminal_records_score ON public.criminal_records (score DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_score ON public.volunteers (score DESC);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND upper(coalesce(p.role, '')) = 'ADMIN'
  );
$$;

ALTER TABLE public.criminal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS criminal_records_read_authenticated ON public.criminal_records;
CREATE POLICY criminal_records_read_authenticated
  ON public.criminal_records
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS criminal_records_admin_write ON public.criminal_records;
CREATE POLICY criminal_records_admin_write
  ON public.criminal_records
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS volunteers_read_authenticated ON public.volunteers;
CREATE POLICY volunteers_read_authenticated
  ON public.volunteers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS volunteers_admin_write ON public.volunteers;
CREATE POLICY volunteers_admin_write
  ON public.volunteers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS crimes_admin_update ON public.crimes;
CREATE POLICY crimes_admin_update
  ON public.crimes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS crimes_admin_delete ON public.crimes;
CREATE POLICY crimes_admin_delete
  ON public.crimes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS crimes_admin_insert ON public.crimes;
CREATE POLICY crimes_admin_insert
  ON public.crimes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS sos_alerts_admin_update ON public.sos_alerts;
CREATE POLICY sos_alerts_admin_update
  ON public.sos_alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
