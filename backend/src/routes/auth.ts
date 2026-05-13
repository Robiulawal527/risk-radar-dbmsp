import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as authService from '../services/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const authRouter: IRouter = Router();

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const tokens = await authService.signup(req.body);
    res.json({ success: true, data: tokens });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const tokens = await authService.login(req.body);
    res.json({ success: true, data: tokens });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ success: true, data: req.user });
  })
);
