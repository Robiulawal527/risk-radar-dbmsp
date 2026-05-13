import type { NextFunction, Response } from 'express';
import { UserRole } from '@risk-radar/types';
import type { AuthedRequest } from './auth.js';
import { HttpError } from '../lib/http-error.js';

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const userRole = (req.user?.role as UserRole) || UserRole.USER;
    if (!roles.includes(userRole)) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    next();
  };
}
