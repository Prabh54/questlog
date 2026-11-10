import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../config/env';

function secretMatches(presented: string | undefined): boolean {
  if (!env.PROXY_SECRET || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(env.PROXY_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The visitor's IP, for rate limiting. Headers are only believed when they
 * come from something we control; anything a client can set is ignored.
 *
 * 1. Via the web app's nginx proxy (browser → web → API): nginx sends the
 *    visitor's IP in X-Client-IP together with the shared X-Proxy-Auth secret.
 * 2. Directly on Fly.io: Fly's edge overwrites Fly-Client-IP on every request.
 * 3. Otherwise (local dev, tests): the TCP peer address.
 */
export function clientIp(req: Request): string {
  if (secretMatches(req.get('x-proxy-auth'))) {
    const forwarded = req.get('x-client-ip')?.trim();
    if (forwarded) return forwarded;
  }
  if (env.FLY_APP_NAME) {
    const fly = req.get('fly-client-ip')?.trim();
    if (fly) return fly;
  }
  return req.socket.remoteAddress ?? 'unknown';
}
