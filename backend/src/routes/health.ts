import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import { pool } from '@risk-radar/database';
import { asyncHandler } from '../lib/async-handler.js';

export const healthRouter: IRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'risk-radar-api',
  });
});

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    try {
      await pool.query('SELECT 1');

      // Rough capacity signal for operators (50 concurrent user target)
      const poolStats = {
        total: (pool as any).totalCount ?? null,
        idle: (pool as any).idleCount ?? null,
        waiting: (pool as any).waitingCount ?? null,
      };

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        capacity: {
          targetConcurrentUsers: 50,
          dbPool: poolStats,
          note: 'Monitor pool waitingCount and idle under load. Prefer Supabase pooler for DATABASE_URL.',
        },
      });
    } catch (error) {
      const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
      const message = error instanceof Error ? error.message : 'Unknown database error';
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: isProd ? 'Database unavailable' : message,
      });
    }
  })
);
