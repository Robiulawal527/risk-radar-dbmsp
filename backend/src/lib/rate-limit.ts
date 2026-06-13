import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction, Express, Router } from 'express';

/**
 * Rate limiting configuration for 50 concurrent users target.
 *
 * Design goals:
 * - Protect the small-ish DB pool and Supabase from abuse/spam.
 * - Be generous for normal map browsing + occasional reports.
 * - Be very strict on authentication and high-volume write paths (SOS, crime reports).
 * - Per-IP limits (good enough for a city safety app; can upgrade to user-based later).
 */

const isProduction = process.env.NODE_ENV === 'production';

// Helper to create consistent limiters
function createLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    message: { success: false, error: options.message },
    keyGenerator: (req: Request) => {
      // Prefer X-Forwarded-For when behind Railway/Vercel
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  });
}

// Very strict for auth (login/signup) to slow down brute force / credential stuffing
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 12, // 12 attempts per 15 min per IP
  message: 'Too many authentication attempts. Please try again later.',
});

// Write operations (creating reports, SOS, profile updates, etc.)
// 50 users should not generate more than a few writes per minute in a normal scenario.
export const writeLimiter = createLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 25, // 25 writes per 10 minutes per IP
  message: 'You are creating content too quickly. Please slow down.',
  skipSuccessfulRequests: false,
});

// More generous for read-heavy endpoints (map, analytics, rankings, heatmap)
// These are polled by the UI.
export const readLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 reads per minute per IP (~2 per second)
  message: 'Too many requests. Please slow down.',
});

// Very tight for SOS because it is high-signal and can trigger notifications to many people.
export const sosWriteLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 SOS creations/updates per 5 minutes per IP
  message: 'Too many SOS requests in a short time. Please wait before sending another.',
});

// General catch-all for the whole API (safety net)
export const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 300 : 1000, // Generous in dev
  message: 'Too many requests from this IP. Please try again later.',
});

export function applyRateLimiters(app: Express, apiRouter: Router) {
  // Apply general safety net first (protects everything under /api)
  app.use('/api', generalLimiter);

  // Auth routes - strict
  apiRouter.use('/auth/login', authLimiter);
  apiRouter.use('/auth/signup', authLimiter);
  apiRouter.use('/auth/refresh', authLimiter);

  // SOS is special - very strict writes (high impact on other users via notifications)
  apiRouter.use('/sos', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || (req.method === 'PATCH' && (req.path.includes('status') || req.path.includes('update')))) {
      return sosWriteLimiter(req, res, next);
    }
    return next();
  });

  // Other write-heavy routes (crime reports, profile updates)
  const writePaths = ['/crimes', '/users/profile', '/users'];
  writePaths.forEach((path) => {
    apiRouter.use(path, (req: Request, res: Response, next: NextFunction) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return writeLimiter(req, res, next);
      }
      return next();
    });
  });

  // Analytics, heatmap, rankings, predictions - protect the heavier read queries
  const readHeavy = ['/analytics', '/heatmap', '/predictions'];
  readHeavy.forEach((path) => {
    apiRouter.use(path, readLimiter);
  });
}
