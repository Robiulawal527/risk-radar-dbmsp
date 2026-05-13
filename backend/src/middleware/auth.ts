import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '@risk-radar/config';
import type { User } from '@risk-radar/types';
import * as authService from '../services/auth.js';
import { HttpError } from '../lib/http-error.js';

export interface AuthedRequest extends Request {
  user?: User;
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new HttpError(401, 'Missing bearer token'));
  }

  try {
    try {
      req.user = await authService.validateSupabaseToken(token);
      return next();
    } catch {
      const payload = jwt.verify(token, config.auth.jwtSecret) as { sub: string };
      req.user = await authService.validateUser(payload.sub);
      return next();
    }
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
}
