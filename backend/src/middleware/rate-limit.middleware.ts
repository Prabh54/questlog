import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { clientIp } from '../lib/client-ip';

const MINUTE = 60 * 1000;

export interface AuthRateLimiters {
  /** Per visitor IP, every login attempt */
  loginByIp: RequestHandler;
  /** Per account, failed attempts only: stops password guessing from many IPs */
  loginByEmail: RequestHandler;
  registerByIp: RequestHandler;
  refreshByIp: RequestHandler;
}

const passthrough: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => next();

// IPv6 addresses are bucketed by /56 so one host can't rotate through its range
const byIp = (req: Request) => ipKeyGenerator(clientIp(req), 56);

function limiter(name: string, options: Partial<Options>): RequestHandler {
  return rateLimit({
    standardHeaders: 'draft-7', // RateLimit + RateLimit-Policy; Retry-After on 429
    legacyHeaders: false,
    keyGenerator: byIp,
    // We derive the client IP ourselves (see clientIp), not from req.ip
    validate: { xForwardedForHeader: false },
    handler: (_req, res, _next, opts) => {
      const retryAfterMin = Math.ceil(opts.windowMs / MINUTE);
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: `Too many ${name} attempts. Try again in ${retryAfterMin} minutes.`,
      });
    },
    ...options,
  });
}

/**
 * In-memory limiters, built per app instance (tests get fresh counters).
 * The API runs on a single machine; with more, these would move to a shared
 * store such as Redis or Postgres.
 */
export function createAuthRateLimiters(enabled: boolean): AuthRateLimiters {
  if (!enabled) {
    return {
      loginByIp: passthrough,
      loginByEmail: passthrough,
      registerByIp: passthrough,
      refreshByIp: passthrough,
    };
  }
  return {
    loginByIp: limiter('login', { windowMs: 15 * MINUTE, limit: 20 }),
    loginByEmail: limiter('login', {
      windowMs: 15 * MINUTE,
      limit: 5,
      skipSuccessfulRequests: true,
      // Runs after validate(), so the email is already a valid address
      keyGenerator: (req) => `email:${String(req.body?.email ?? '').toLowerCase()}`,
    }),
    registerByIp: limiter('sign-up', { windowMs: 60 * MINUTE, limit: 10 }),
    refreshByIp: limiter('refresh', { windowMs: 15 * MINUTE, limit: 120 }),
  };
}
