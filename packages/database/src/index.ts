import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __riskRadarPgPool: pg.Pool | undefined;
}

function connectionString(): string {
  return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/riskradar';
}

function sslConfig(url: string): pg.PoolConfig['ssl'] {
  const explicit = process.env.DB_SSL?.trim().toLowerCase();
  if (explicit === 'false' || explicit === '0' || explicit === 'disable') return false;
  if (explicit === 'true' || explicit === '1' || explicit === 'require') {
    return { rejectUnauthorized: false };
  }
  if (/sslmode=(require|no-verify)/i.test(url)) return { rejectUnauthorized: false };
  if (/(supabase\.co|supabase\.in|pooler\.supabase\.com)/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

function createPool(): pg.Pool {
  const onVercel = Boolean(process.env.VERCEL);
  const url = connectionString();
  return new pg.Pool({
    connectionString: url,
    ssl: sslConfig(url),
    // Capacity target: ~50 concurrent users.
    // - On Railway (dedicated backend) we can afford a healthy pool.
    // - On Vercel / serverless we stay very conservative.
    // With Supabase, you should also use the connection pooler (pooler.supabase.com) in DATABASE_URL for better scaling.
    max: onVercel ? 4 : 60,
    idleTimeoutMillis: onVercel ? 10_000 : 45_000,
    connectionTimeoutMillis: onVercel ? 8_000 : 12_000,
    // Allow a few more connections under burst for 50 users doing map refreshes + occasional writes
    maxUses: onVercel ? 200 : undefined,
  });
}

export const pool =
  globalThis.__riskRadarPgPool ?? (globalThis.__riskRadarPgPool = createPool());

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const r = await pool.query<T>(text, params);
  return r.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
