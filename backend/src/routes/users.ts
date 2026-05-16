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

// Search users by skill
usersRouter.get(
  '/search',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { skill } = req.query;
    if (!skill || typeof skill !== 'string') {
      return res.status(400).json({ success: false, message: 'Skill query required' });
    }
    // Find users with the skill (case-insensitive)
    const rows = await userService.searchUsersBySkill(skill, req.user!.id);
    res.json({ success: true, data: rows });
  })
);
