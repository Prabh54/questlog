import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { AppError, Errors } from '../lib/errors';
import type { LoginBody, RegisterBody, UpdateMeBody } from '@questlog/shared';
import { getUserTotalXp } from './entry.service';
import { levelProgress } from './xp.service';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from '../lib/tokens';
import {
  createSession,
  invalidRefreshToken,
  rotateRefreshToken,
  type IssuedRefreshToken,
} from './session.service';

const BCRYPT_ROUNDS = 12;

// XP / level are derived from the user's entries (the single source of truth)
const safeUser = async (user: {
  id: string;
  email: string;
  username: string;
  role: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const { xp, level, xpToNext, progress } = levelProgress(await getUserTotalXp(user.id));
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    xp,
    level,
    xpToNext,
    progress,
    timezone: user.timezone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export interface AuthResult {
  /** Response body: short-lived access token + the user */
  body: { token: string; expiresIn: number; user: Awaited<ReturnType<typeof safeUser>> };
  /** Goes into the HttpOnly cookie, never the body */
  refresh: IssuedRefreshToken;
}

async function authResult(
  user: Parameters<typeof safeUser>[0],
  refresh: IssuedRefreshToken,
): Promise<AuthResult> {
  const token = signAccessToken({ userId: user.id, email: user.email, sessionId: refresh.sessionId });
  return {
    body: { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user: await safeUser(user) },
    refresh,
  };
}

export async function register(body: RegisterBody, userAgent?: string): Promise<AuthResult> {
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: body.display_name }] },
  });
  if (existing) {
    throw existing.email === email
      ? new AppError('EMAIL_TAKEN', 409, 'Email is already registered')
      : new AppError('USERNAME_TAKEN', 409, 'Display name is already taken');
  }

  const password = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, username: body.display_name, password },
  });

  return authResult(user, await createSession(user.id, userAgent));
}

export async function login(body: LoginBody, userAgent?: string): Promise<AuthResult> {
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Compare even when no user found to prevent timing attacks
  const passwordHash = user?.password ?? '$2a$12$invalidsaltinvalidsaltinvalidsa';
  const valid = await bcrypt.compare(body.password, passwordHash);

  if (!user || !valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  return authResult(user, await createSession(user.id, userAgent));
}

/** Rotates the refresh token and mints a new access token. */
export async function refresh(presentedToken: string): Promise<AuthResult> {
  const issued = await rotateRefreshToken(presentedToken);
  const user = await prisma.user.findUnique({ where: { id: issued.userId } });
  if (!user) throw invalidRefreshToken();
  return authResult(user, issued);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound('User');
  return { user: await safeUser(user) };
}

export async function updateMe(userId: string, body: UpdateMeBody) {
  if (body.display_name) {
    const taken = await prisma.user.findFirst({
      where: { username: body.display_name, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new AppError('USERNAME_TAKEN', 409, 'That display name is already taken');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.display_name && { username: body.display_name }),
      ...(body.timezone && { timezone: body.timezone }),
    },
  });
  return { user: await safeUser(user) };
}
