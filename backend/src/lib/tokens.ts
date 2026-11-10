import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ── Lifetimes ──────────────────────────────────────────────────────────────
/** Access tokens are short-lived and kept only in the client's memory. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Idle timeout: a session not refreshed within this window ends. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Absolute session lifetime; rotation never extends a session past it. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const ISSUER = 'questlog-api';
const AUDIENCE = 'questlog';

// ── Access tokens (JWT, HS256) ─────────────────────────────────────────────
export interface AccessTokenClaims {
  userId: string;
  email: string;
  sessionId: string;
}

export function signAccessToken({ userId, email, sessionId }: AccessTokenClaims): string {
  return jwt.sign({ email, sid: sessionId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/** Throws if the token is malformed, expired, or not one we issued. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'], // never accept "none" or an algorithm swap
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.sid !== 'string'
  ) {
    throw new Error('Malformed access token');
  }
  return { userId: payload.sub, email: payload.email, sessionId: payload.sid };
}

// ── Refresh tokens (opaque) ────────────────────────────────────────────────
/** 256 bits of randomness, URL-safe. Only its hash is ever stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 is enough here (no salt or bcrypt needed): the input is 256 random
 * bits, so there is nothing to brute-force, and lookups must be by hash.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
