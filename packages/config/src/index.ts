import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Find the monorepo root by walking up from this package (works for both src/ and dist/ layouts
 * and when the process cwd is the package dir during `turbo run` or `pnpm dev` from root).
 */
function getMonorepoRoot(): string {
  let current = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const parent = path.resolve(current, '..');
    if (
      existsSync(path.join(parent, 'pnpm-workspace.yaml')) ||
      existsSync(path.join(parent, 'turbo.json')) ||
      existsSync(path.join(parent, 'package.json'))
    ) {
      // Heuristic: if this parent has the workspace marker or is the top package.json of monorepo
      if (existsSync(path.join(parent, 'pnpm-workspace.yaml')) || existsSync(path.join(parent, 'turbo.json'))) {
        return parent;
      }
      // Fallback: keep walking one more if only saw a package.json
    }
    current = parent;
    if (!path.basename(current) || path.basename(current) === path.basename(parent)) break;
  }
  // Safe fallback: packages/config -> ../../..
  return path.resolve(__dirname, '../../..');
}

function loadEnvFile(filePath: string) {
  if (existsSync(filePath)) {
    // Do not override vars that are already set in the environment (e.g. platform-provided in prod,
    // or earlier loads). .env.local and later files take precedence within our explicit loads.
    dotenvConfig({ path: filePath, override: false });
  }
}

function loadEnvsFrom(dir: string) {
  // Conventional precedence similar to Next.js / dotenv conventions
  loadEnvFile(path.join(dir, '.env'));
  loadEnvFile(path.join(dir, '.env.local'));
  if (NODE_ENV) {
    loadEnvFile(path.join(dir, `.env.${NODE_ENV}`));
    loadEnvFile(path.join(dir, `.env.${NODE_ENV}.local`));
  }
}

function loadAllEnvs() {
  const root = getMonorepoRoot();
  loadEnvsFrom(root);

  const cwd = process.cwd();
  if (path.resolve(cwd) !== path.resolve(root)) {
    loadEnvsFrom(cwd);
  }

  // Final pass: honor any .env sitting directly for the current process cwd (original behavior)
  dotenvConfig({ override: false });
}

// Load environment variables from monorepo root (and cwd) so that `pnpm dev` (turbo) from the
// repository root correctly supplies BACKEND secrets (SUPABASE_*, JWT_*, DATABASE_URL, etc.)
// to the backend package even though its cwd during turbo execution is packages/backend/.
loadAllEnvs();

/** True when running on a hosted platform where secrets must be set (not local `pnpm dev`). */
function isCloudRuntime(): boolean {
  if (process.env.VERCEL) return true;
  if (process.env.FLY_APP_NAME) return true;
  if (process.env.RENDER) return true;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  if (process.env.RAILWAY_ENVIRONMENT_NAME) return true;
  if (process.env.RAILWAY_PROJECT_ID) return true;
  if (process.env.RAILWAY_SERVICE_ID) return true;
  if (process.env.RAILWAY_SERVICE_NAME) return true;
  if (process.env.RAILWAY_DEPLOYMENT_ID) return true;
  return false;
}

if (isCloudRuntime()) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET?.trim()) missing.push('JWT_SECRET');
  if (!process.env.SUPABASE_URL?.trim()) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY?.trim()) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const db = process.env.DATABASE_URL?.trim() ?? '';
  if (!db || /localhost|127\.0\.0\.1/i.test(db) || !/^postgres(?:ql)?:\/\//i.test(db)) {
    missing.push('DATABASE_URL (must be a hosted postgres:// or postgresql:// Supabase connection string)');
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
