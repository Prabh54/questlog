/**
 * Sessions and rotating refresh tokens.
 *
 *   login ─► Session (absolute 30-day lifetime)
 *              └─ RefreshToken #1 ──refresh──► #2 ──refresh──► #3 …
 *
 * Each refresh token is single-use. Refreshing atomically marks the presented
 * token used and issues its successor. If a token that was already used is
 * presented again, someone has a copy of it (the legitimate client never
 * reuses one), so the whole session is revoked: the attacker's and the user's
 * tokens both stop working, and the user is asked to log in again.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../lib/errors';
import {
  REFRESH_TOKEN_TTL_MS,
  SESSION_MAX_AGE_MS,
  generateRefreshToken,
  hashRefreshToken,
} from '../lib/tokens';

export type RevokeReason = 'LOGOUT' | 'LOGOUT_ALL' | 'REUSE_DETECTED';

export interface IssuedRefreshToken {
  sessionId: string;
  userId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** One error for every refresh failure, so callers learn nothing about why. */
export const invalidRefreshToken = () =>
  new AppError('INVALID_REFRESH_TOKEN', 401, 'Session expired. Please log in again.');

type Db = Prisma.TransactionClient | typeof prisma;

async function issueToken(
  db: Db,
  session: { id: string; userId: string; expiresAt: Date },
  now: Date,
): Promise<IssuedRefreshToken> {
  const refreshToken = generateRefreshToken();
  const idleExpiry = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const refreshExpiresAt = idleExpiry < session.expiresAt ? idleExpiry : session.expiresAt;
  await db.refreshToken.create({
    data: {
      sessionId: session.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
    },
  });
  return { sessionId: session.id, userId: session.userId, refreshToken, refreshExpiresAt };
}

/** Starts a new session (one per login) and returns its first refresh token. */
export async function createSession(
  userId: string,
  userAgent?: string,
  now = new Date(),
): Promise<IssuedRefreshToken> {
  // Housekeeping: drop this user's sessions that can no longer be used
  await prisma.session.deleteMany({
    where: {
      userId,
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - SESSION_MAX_AGE_MS) } },
      ],
    },
  });

  return prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
        userAgent: userAgent?.slice(0, 255) || null,
      },
    });
    return issueToken(tx, session, now);
  });
}

/**
 * Exchanges a refresh token for its successor.
 * Throws INVALID_REFRESH_TOKEN (401) if it is unknown, expired, revoked, or reused.
 */
export async function rotateRefreshToken(
  presented: string,
  now = new Date(),
): Promise<IssuedRefreshToken> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(presented) },
    include: { session: true },
  });
  if (!record || record.session.revokedAt) throw invalidRefreshToken();

  if (record.usedAt) {
    await reportReuse(record.sessionId, record.session.userId);
    throw invalidRefreshToken();
  }
  if (record.expiresAt <= now || record.session.expiresAt <= now) throw invalidRefreshToken();

  const issued = await prisma.$transaction(async (tx) => {
    // Claim the token. The row lock makes this the single point of truth when
    // the same token is presented concurrently: exactly one request sees count 1.
    const claim = await tx.refreshToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claim.count === 0) return null;

    await tx.session.update({ where: { id: record.sessionId }, data: { lastUsedAt: now } });
    return issueToken(tx, record.session, now);
  });

  if (!issued) {
    // Lost the race to another request presenting the same token: also a reuse
    await reportReuse(record.sessionId, record.session.userId);
    throw invalidRefreshToken();
  }
  return issued;
}

async function reportReuse(sessionId: string, userId: string) {
  await revokeSession(sessionId, 'REUSE_DETECTED');
  console.warn('[auth] refresh token reuse detected; session revoked', { sessionId, userId });
}

/** Revokes the session a refresh token belongs to (logout). Unknown tokens are ignored. */
export async function revokeSessionByToken(presented: string): Promise<void> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(presented) },
    select: { sessionId: true },
  });
  if (record) await revokeSession(record.sessionId, 'LOGOUT');
}

export async function revokeSession(sessionId: string, reason: RevokeReason): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** "Log out everywhere": ends every active session of the user. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' },
  });
  return count;
}
