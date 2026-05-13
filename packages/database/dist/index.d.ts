import pg from 'pg';
declare global {
    var __riskRadarPgPool: pg.Pool | undefined;
}
export declare const pool: pg.Pool;
export declare function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
export declare function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
