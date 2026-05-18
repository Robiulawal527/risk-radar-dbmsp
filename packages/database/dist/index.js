"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.queryOne = queryOne;
const pg_1 = __importDefault(require("pg"));
function connectionString() {
    return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/riskradar';
}
function sslConfig(url) {
    const explicit = process.env.DB_SSL?.trim().toLowerCase();
    if (explicit === 'false' || explicit === '0' || explicit === 'disable')
        return false;
    if (explicit === 'true' || explicit === '1' || explicit === 'require') {
        return { rejectUnauthorized: false };
    }
    if (/sslmode=(require|no-verify)/i.test(url))
        return { rejectUnauthorized: false };
    if (/(supabase\.co|supabase\.in|pooler\.supabase\.com)/i.test(url)) {
        return { rejectUnauthorized: false };
    }
    return false;
}
function createPool() {
    const onVercel = Boolean(process.env.VERCEL);
    const url = connectionString();
    return new pg_1.default.Pool({
        connectionString: url,
        ssl: sslConfig(url),
        // Serverless: reuse one warm pool per isolate; keep concurrency low.
        max: onVercel ? 3 : 20,
        idleTimeoutMillis: onVercel ? 10000 : 30000,
        connectionTimeoutMillis: onVercel ? 8000 : 10000,
    });
}
exports.pool = globalThis.__riskRadarPgPool ?? (globalThis.__riskRadarPgPool = createPool());
async function query(text, params) {
    const r = await exports.pool.query(text, params);
    return r.rows;
}
async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] ?? null;
}
