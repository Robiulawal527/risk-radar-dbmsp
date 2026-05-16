import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import { SOSStatus } from '@risk-radar/types';
import * as sosService from '../services/sos.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const sosRouter: IRouter = Router();

sosRouter.use(requireAuth);

// Returns every active SOS so maps and realtime dashboards can show only unresolved emergencies.
sosRouter.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const requests = await sosService.getActiveSOSRequests();
    res.json({ success: true, data: requests });
  })
);

// Returns the signed-in user's SOS history, including resolved alerts for accountability.
sosRouter.get(
  '/user',
  asyncHandler(async (req: AuthedRequest, res) => {
    const requests = await sosService.getUserSOSRequests(req.user!.id);
    res.json({ success: true, data: requests });
  })
);

// Creates a new active SOS using the authenticated user id rather than trusting client-supplied ownership.
sosRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { location, message } = req.body;
    const sosRequest = await sosService.createSOSRequest(req.user!.id, location, message);
    res.json({ success: true, data: sosRequest });
  })
);

// Updates status for an owned SOS row; ownership is enforced in the service query.
sosRouter.put(
  '/:id/status',
  asyncHandler(async (req: AuthedRequest, res) => {
    const sosRequest = await sosService.updateSOSStatus(req.params.id, req.user!.id, req.body.status);
    res.json({ success: true, data: sosRequest });
  })
);

// Soft-deletes an owned SOS by resolving it, which removes it from active feeds without destroying history.
sosRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const sosRequest = await sosService.resolveSOSRequest(req.params.id, req.user!.id);
    res.json({
      success: true,
      data: sosRequest,
      message: sosRequest.status === SOSStatus.RESOLVED ? 'SOS resolved' : 'SOS updated',
    });
  })
);
