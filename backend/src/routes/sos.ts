import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as sosService from '../services/sos.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const sosRouter: IRouter = Router();

sosRouter.use(requireAuth);

sosRouter.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const requests = await sosService.getActiveSOSRequests();
    res.json({ success: true, data: requests });
  })
);

sosRouter.get(
  '/user',
  asyncHandler(async (req: AuthedRequest, res) => {
    const requests = await sosService.getUserSOSRequests(req.user!.id);
    res.json({ success: true, data: requests });
  })
);

sosRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { location, message } = req.body;
    const sosRequest = await sosService.createSOSRequest(req.user!.id, location, message);
    res.json({ success: true, data: sosRequest });
  })
);

sosRouter.put(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const sosRequest = await sosService.updateSOSStatus(req.params.id, req.body.status);
    res.json({ success: true, data: sosRequest });
  })
);
