import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

/**
 * CSRF defence in depth for the cookie-authenticated endpoints (refresh,
 * logout). SameSite=Strict already stops browsers from sending the cookie
 * cross-site; this also rejects any browser request whose Origin is not the
 * web app, or that the browser itself labels cross-site. Non-browser clients
 * send neither header and are unaffected (they can't ride a victim's cookie).
 */
export const requireTrustedOrigin = (req: Request, _res: Response, next: NextFunction) => {
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if ((origin && !env.CORS_ORIGIN.includes(origin)) || fetchSite === 'cross-site') {
    next(new AppError('FORBIDDEN_ORIGIN', 403, 'Request origin not allowed'));
    return;
  }
  next();
};
