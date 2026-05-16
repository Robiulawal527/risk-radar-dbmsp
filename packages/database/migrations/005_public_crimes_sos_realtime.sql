-- Supabase public mobile tables for direct Expo client writes and realtime map updates.
-- Apply in Supabase SQL editor, or with: psql "$DATABASE_URL" -f packages/database/migrations/005_public_crimes_sos_realtime.sql

CREATE TABLE IF NOT EXISTS public.crimes (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'OTHER',
  category text,
  title text NOT NULL DEFAULT 'Incident report',
  description text NOT NULL DEFAULT 'No description provided.',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  area text,
  district text,
  division text,
  severity text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'REPORTED',
  reported_by text,
  date_time timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'OTHER';
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Incident report';
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT 'No description provided.';
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS division text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'REPORTED';
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS reported_by text;
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS date_time timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.crimes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_public_crimes_created_at ON public.crimes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_crimes_location ON public.crimes (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_public_crimes_user_id ON public.crimes (user_id);

CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_public_sos_alerts_created_at ON public.sos_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_sos_alerts_status ON public.sos_alerts (status);
CREATE INDEX IF NOT EXISTS idx_public_sos_alerts_location ON public.sos_alerts (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_public_sos_alerts_user_id ON public.sos_alerts (user_id);

ALTER TABLE public.crimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crimes_select_authenticated ON public.crimes;
CREATE POLICY crimes_select_authenticated
  ON public.crimes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS crimes_insert_own ON public.crimes;
CREATE POLICY crimes_insert_own
  ON public.crimes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sos_alerts_select_authenticated ON public.sos_alerts;
CREATE POLICY sos_alerts_select_authenticated
  ON public.sos_alerts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS sos_alerts_insert_own ON public.sos_alerts;
CREATE POLICY sos_alerts_insert_own
  ON public.sos_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.crimes REPLICA IDENTITY FULL;
ALTER TABLE public.sos_alerts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crimes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crimes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sos_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
  END IF;
END $$;
