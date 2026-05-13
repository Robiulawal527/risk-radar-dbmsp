import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __riskRadarPgPool: pg.Pool | undefined;
}

function connectionString(): string {
  return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/riskradar';
}

function createPool(): pg.Pool {
  const onVercel = Boolean(process.env.VERCEL);
  return new pg.Pool({
    connectionString: connectionString(),
    // Serverless: reuse one warm pool per isolate; keep concurrency low.
    max: onVercel ? 3 : 20,
    idleTimeoutMillis: onVercel ? 10_000 : 30_000,
    connectionTimeoutMillis: onVercel ? 8_000 : 10_000,
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
