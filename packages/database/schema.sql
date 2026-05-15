-- Risk Radar PostgreSQL schema (apply with: psql "$DATABASE_URL" -f packages/database/schema.sql)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  skills TEXT[],
  avatar TEXT,
  role TEXT DEFAULT 'USER',
  "alertLatitude" DOUBLE PRECISION,
  "alertLongitude" DOUBLE PRECISION,
  "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Crime" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  area TEXT,
  district TEXT,
  division TEXT,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REPORTED',
  "reportedBy" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "victimInfo" JSONB,
  "criminalInfo" JSONB,
  witnesses JSONB DEFAULT '[]'::jsonb,
  "dateTime" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Evidence" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "crimeId" TEXT NOT NULL REFERENCES "Crime"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SOSRequest" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  area TEXT,
  district TEXT,
  division TEXT,
  message TEXT,
  contacts JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "Notification" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CrimePrediction" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  area TEXT NOT NULL,
  district TEXT,
  "predictedCrimeType" TEXT NOT NULL,
  probability DOUBLE PRECISION NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "timeFrame" TEXT NOT NULL,
  factors JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  "validUntil" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CriminalRecord" (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  description TEXT NOT NULL,
  "knownAliases" JSONB NOT NULL,
  "photoUrl" TEXT,
  status TEXT NOT NULL,
  "crimeCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crime_user ON "Crime" ("userId");
CREATE INDEX IF NOT EXISTS idx_crime_area ON "Crime" (area);
CREATE INDEX IF NOT EXISTS idx_crime_datetime ON "Crime" ("dateTime");
CREATE INDEX IF NOT EXISTS idx_evidence_crime ON "Evidence" ("crimeId");
CREATE INDEX IF NOT EXISTS idx_sos_user ON "SOSRequest" ("userId");
CREATE INDEX IF NOT EXISTS idx_notification_user ON "Notification" ("userId");

-- Supabase Auth-backed profiles (public client-safe when RLS policies are applied).
-- In Supabase, `auth.users` is the source of truth for credentials.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now()
);
