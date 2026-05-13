import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as predictionService from '../services/prediction.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middleware/auth.js';

export const predictionsRouter: IRouter = Router();

predictionsRouter.use(requireAuth);

predictionsRouter.get(
  '/area/:area',
  asyncHandler(async (req, res) => {
    const prediction = await predictionService.getPredictionByArea(req.params.area);
    res.json({ success: true, data: prediction });
  })
);

predictionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const area = req.query.area as string | undefined;
    const predictions = await predictionService.getPredictions(area);
    res.json({ success: true, data: predictions });
  })
);
