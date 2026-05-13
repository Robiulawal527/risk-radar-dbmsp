import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import { UserRole } from '@risk-radar/types';
import * as crimeService from '../services/crime.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/require-roles.js';

export const crimesRouter: IRouter = Router();

crimesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, type, severity, area, district } = req.query;
    const crimes = await crimeService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type: type as any,
      severity: severity as any,
      area: area as string | undefined,
      district: district as string | undefined,
    });
    res.json({ success: true, data: crimes });
  })
);

crimesRouter.get(
  '/area/:area',
  requireAuth,
  asyncHandler(async (req, res) => {
    const crimes = await crimeService.findByArea(req.params.area);
    res.json({ success: true, data: crimes });
  })
);

crimesRouter.get(
  '/location/:lat/:lng',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.params;
    const radius = req.query.radius as string | undefined;
    const crimes = await crimeService.findByCoordinates(
      Number(lat),
      Number(lng),
      radius ? Number(radius) : undefined
    );
    res.json({ success: true, data: crimes });
  })
);

crimesRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const crime = await crimeService.findById(req.params.id);
    res.json({ success: true, data: crime });
  })
);

crimesRouter.post(
  '/',
  requireAuth,
  requireRoles(UserRole.ADMIN, UserRole.USER),
  asyncHandler(async (req: AuthedRequest, res) => {
    const crime = await crimeService.create(req.body, req.user!.id);
    res.json({ success: true, data: crime });
  })
);

crimesRouter.put(
  '/:id',
  requireAuth,
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const crime = await crimeService.update(req.params.id, req.body);
    res.json({ success: true, data: crime });
  })
);

crimesRouter.delete(
  '/:id',
  requireAuth,
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    await crimeService.remove(req.params.id);
    res.json({ success: true });
  })
);
