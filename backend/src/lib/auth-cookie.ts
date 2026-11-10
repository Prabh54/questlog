import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * The refresh token lives only in this cookie:
 *  - HttpOnly: page JavaScript (and so any XSS) can never read it
 *  - SameSite=Strict: browsers never attach it to cross-site requests (CSRF)
 *  - Secure + the "__Host-" prefix in production: HTTPS only, and the browser
 *    rejects it unless it is host-only with Path=/, so a sibling subdomain
 *    can't overwrite it
 *
 * Path=/ because the browser reaches this API both directly and through the
 * web app's /api proxy, so the visible path differs.
 */
const secure = env.NODE_ENV === 'production';
export const REFRESH_COOKIE = secure ? '__Host-ql_refresh' : 'ql_refresh';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'strict',
  path: '/',
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
