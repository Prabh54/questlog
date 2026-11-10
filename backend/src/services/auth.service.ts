import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { AppError, Errors } from '../lib/errors';
import type { LoginBody, RegisterBody, UpdateMeBody } from '@questlog/shared';
import { getUserTotalXp } from './entry.service';
import { levelProgress } from './xp.service';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

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

function signToken(id: string, email: string): string {
  return jwt.sign({ id, email }, env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(body: RegisterBody) {
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

  return { token: signToken(user.id, user.email), user: await safeUser(user) };
}

export async function login(body: LoginBody) {
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Compare even when no user found to prevent timing attacks
  const passwordHash = user?.password ?? '$2a$12$invalidsaltinvalidsaltinvalidsa';
  const valid = await bcrypt.compare(body.password, passwordHash);

  if (!user || !valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  return { token: signToken(user.id, user.email), user: await safeUser(user) };
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
