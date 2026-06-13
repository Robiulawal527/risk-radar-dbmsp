"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const NODE_ENV = process.env.NODE_ENV || 'development';
/**
 * Find the monorepo root by walking up from this package (works for both src/ and dist/ layouts
 * and when the process cwd is the package dir during `turbo run` or `pnpm dev` from root).
 */
function getMonorepoRoot() {
    let current = __dirname;
    for (let i = 0; i < 6; i += 1) {
        const parent = path_1.default.resolve(current, '..');
        if ((0, fs_1.existsSync)(path_1.default.join(parent, 'pnpm-workspace.yaml')) ||
            (0, fs_1.existsSync)(path_1.default.join(parent, 'turbo.json')) ||
            (0, fs_1.existsSync)(path_1.default.join(parent, 'package.json'))) {
            // Heuristic: if this parent has the workspace marker or is the top package.json of monorepo
            if ((0, fs_1.existsSync)(path_1.default.join(parent, 'pnpm-workspace.yaml')) || (0, fs_1.existsSync)(path_1.default.join(parent, 'turbo.json'))) {
                return parent;
            }
            // Fallback: keep walking one more if only saw a package.json
        }
        current = parent;
        if (!path_1.default.basename(current) || path_1.default.basename(current) === path_1.default.basename(parent))
            break;
    }
    // Safe fallback: packages/config -> ../../..
    return path_1.default.resolve(__dirname, '../../..');
}
function loadEnvFile(filePath) {
    if ((0, fs_1.existsSync)(filePath)) {
        // Do not override vars that are already set in the environment (e.g. platform-provided in prod,
        // or earlier loads). .env.local and later files take precedence within our explicit loads.
        (0, dotenv_1.config)({ path: filePath, override: false });
    }
}
function loadEnvsFrom(dir) {
    // Conventional precedence similar to Next.js / dotenv conventions
    loadEnvFile(path_1.default.join(dir, '.env'));
    loadEnvFile(path_1.default.join(dir, '.env.local'));
    if (NODE_ENV) {
        loadEnvFile(path_1.default.join(dir, `.env.${NODE_ENV}`));
        loadEnvFile(path_1.default.join(dir, `.env.${NODE_ENV}.local`));
    }
}
function loadAllEnvs() {
    const root = getMonorepoRoot();
    loadEnvsFrom(root);
    const cwd = process.cwd();
    if (path_1.default.resolve(cwd) !== path_1.default.resolve(root)) {
        loadEnvsFrom(cwd);
    }
    // Final pass: honor any .env sitting directly for the current process cwd (original behavior)
    (0, dotenv_1.config)({ override: false });
}
// Load environment variables from monorepo root (and cwd) so that `pnpm dev` (turbo) from the
// repository root correctly supplies BACKEND secrets (SUPABASE_*, JWT_*, DATABASE_URL, etc.)
// to the backend package even though its cwd during turbo execution is packages/backend/.
loadAllEnvs();
/** True when running on a hosted platform where secrets must be set (not local `pnpm dev`). */
function isCloudRuntime() {
    if (process.env.VERCEL)
        return true;
    if (process.env.FLY_APP_NAME)
        return true;
    if (process.env.RENDER)
        return true;
    if (process.env.RAILWAY_ENVIRONMENT)
        return true;
    if (process.env.RAILWAY_ENVIRONMENT_NAME)
        return true;
    if (process.env.RAILWAY_PROJECT_ID)
        return true;
    if (process.env.RAILWAY_SERVICE_ID)
        return true;
    if (process.env.RAILWAY_SERVICE_NAME)
        return true;
    if (process.env.RAILWAY_DEPLOYMENT_ID)
        return true;
    return false;
}
if (isCloudRuntime()) {
    const missing = [];
    if (!process.env.JWT_SECRET?.trim())
        missing.push('JWT_SECRET');
    if (!process.env.SUPABASE_URL?.trim())
        missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_ANON_KEY?.trim())
        missing.push('SUPABASE_ANON_KEY');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
        missing.push('SUPABASE_SERVICE_ROLE_KEY');
    const db = process.env.DATABASE_URL?.trim() ?? '';
    if (!db || /localhost|127\.0\.0\.1/i.test(db) || !/^postgres(?:ql)?:\/\//i.test(db)) {
        missing.push('DATABASE_URL (must be a hosted postgres:// or postgresql:// Supabase connection string)');
    }
    if (missing.length) {
        throw new Error(`[risk-radar/config] Missing or invalid production environment: ${missing.join('; ')}. Set these in your host (Vercel / Railway / etc.).`);
    }
}
exports.config = {
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
