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
function createPool() {
    const onVercel = Boolean(process.env.VERCEL);
    return new pg_1.default.Pool({
        connectionString: connectionString(),
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
