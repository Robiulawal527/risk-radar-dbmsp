import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as analyticsService from '../services/analytics.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const analyticsRouter: IRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await analyticsService.getCrimeStats();
    res.json({ success: true, data: stats });
  })
);

analyticsRouter.get(
  '/rankings/areas',
  asyncHandler(async (_req, res) => {
    const rankings = await analyticsService.getAreaRankings();
    res.json({ success: true, data: rankings });
  })
);

analyticsRouter.get(
  '/rankings/criminals',
  asyncHandler(async (_req, res) => {
    const rankings = await analyticsService.getCriminalRankings();
    res.json({ success: true, data: rankings });
  })
);

analyticsRouter.get(
  '/rankings/philanthropists',
  asyncHandler(async (_req, res) => {
    const rankings = await analyticsService.getPhilanthropistRankings();
    res.json({ success: true, data: rankings });
  })
);

analyticsRouter.get(
  '/social-radar',
  asyncHandler(async (req: AuthedRequest, res) => {
    const interests = (req.query.interests as string | undefined)
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) || [];
    const lookingFor = (req.query.lookingFor as string | undefined)
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) || [];
    const matches = await analyticsService.getSocialRadarMatches(
      req.user!.id,
      interests,
      lookingFor
    );
    res.json({ success: true, data: matches });
  })
);
