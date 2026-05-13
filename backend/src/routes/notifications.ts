import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as notificationService from '../services/notification.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const notificationsRouter: IRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const notifications = await notificationService.getUserNotifications(req.user!.id);
    res.json({ success: true, data: notifications });
  })
);

notificationsRouter.put(
  '/read-all',
  asyncHandler(async (req: AuthedRequest, res) => {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true });
  })
);

notificationsRouter.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await notificationService.markAsRead(req.params.id);
    res.json({ success: true });
  })
);
