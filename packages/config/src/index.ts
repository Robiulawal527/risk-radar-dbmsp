import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

/** True when running on a hosted platform where secrets must be set (not local `pnpm dev`). */
function isCloudRuntime(): boolean {
  if (process.env.VERCEL) return true;
  if (process.env.FLY_APP_NAME) return true;
  if (process.env.RENDER) return true;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  if (process.env.RAILWAY_ENVIRONMENT_NAME) return true;
  if (process.env.RAILWAY_PROJECT_ID) return true;
  return false;
}

if (isCloudRuntime()) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET?.trim()) missing.push('JWT_SECRET');
  if (!process.env.SUPABASE_URL?.trim()) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY?.trim()) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const db = process.env.DATABASE_URL?.trim() ?? '';
  if (!db || /localhost|127\.0\.0\.1/i.test(db)) {
    missing.push('DATABASE_URL (must be your hosted Postgres / Supabase connection string)');
  }
  if (missing.length) {
    throw new Error(
      `[risk-radar/config] Missing or invalid production environment: ${missing.join(
        '; '
      )}. Set these in your host (Vercel / Railway / etc.).`
    );
  }
}

export const config = {
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-risk-radar-2026',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/riskradar',
  },
  port: process.env.PORT || 3001,
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001',
};

export type Config = typeof config;
