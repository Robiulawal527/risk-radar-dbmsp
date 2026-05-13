-- Run after base schema: psql "$DATABASE_URL" -f packages/database/migrations/001_user_alert_location.sql
-- Used for "incident near me" push-style in-app notifications (Haversine radius).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alertLatitude" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alertLongitude" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;
