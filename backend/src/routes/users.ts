import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as userService from '../services/user.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const usersRouter: IRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ success: true, data: req.user });
  })
);

usersRouter.put(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const updated = await userService.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: updated });
  })
);

usersRouter.put(
  '/password',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true });
  })
);
