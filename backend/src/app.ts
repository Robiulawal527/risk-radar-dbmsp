import express, { type Express } from 'express';
import cors from 'cors';
import { Router } from 'express';
import { HttpError } from './lib/http-error.js';
import { applyRateLimiters } from './lib/rate-limit.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { crimesRouter } from './routes/crimes.js';
import { usersRouter } from './routes/users.js';
import { analyticsRouter } from './routes/analytics.js';
import { predictionsRouter } from './routes/predictions.js';
import { sosRouter } from './routes/sos.js';
import { notificationsRouter } from './routes/notifications.js';
import { heatmapRouter } from './routes/heatmap.js';

function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const defaults = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:19006'];

  const allowList = new Set([...defaults, ...configuredOrigins]);

  if (!origin) {
    return callback(null, true);
  }

  if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
    return callback(null, true);
  }

  if (allowList.has(origin)) {
    return callback(null, true);
  }

  // Vercel preview + production deployments (https://*.vercel.app)
  if (/^https:\/\/[^/]+\.vercel\.app$/i.test(origin)) {
    return callback(null, true);
  }

  return callback(null, false);
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Risk Radar API',
      health: '/api/health',
      api: '/api',
    });
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  const api = Router();

  // Apply rate limiters early (before mounting sub-routers)
  // This protects the backend + database pool for a 50 concurrent user target.
  applyRateLimiters(app, api);

  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/crimes', crimesRouter);
  api.use('/users', usersRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/predictions', predictionsRouter);
  api.use('/sos', sosRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/heatmap', heatmapRouter);

  app.use('/api', api);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error(err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}
