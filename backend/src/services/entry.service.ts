import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError, Errors } from '../lib/errors';
import { encodeCursor, decodeCursor } from '../utils/cursor';
import { bucketBoundaries, periodKey } from '../utils/dates';
import type { CompleteQuestBody, FeedQuery } from '../validators/entry.validators';
import { calculateStreak } from './streak.service';
import { levelProgress } from './xp.service';

// ── Complete a quest ──────────────────────────────────────────────────────
const alreadyCompleted = () =>
  new AppError(
    'ALREADY_COMPLETED_TODAY',
    409,
    'This quest is already completed for the current period',
  );

export async function completeQuest(
  questId: string,
  userId: string,
  body: CompleteQuestBody,
) {
  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || quest.userId !== userId) throw Errors.notFound('Quest');
  if (quest.status === 'ARCHIVED') {
    throw new AppError('QUEST_ARCHIVED', 400, 'Cannot complete an archived quest');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound('User');
  const timezone = user.timezone;

  // Idempotency window per frequency
  const { start, end } = bucketBoundaries(quest.frequency, timezone);

  const existing = await prisma.questEntry.findFirst({
    where: {
      questId,
      ...(quest.frequency === 'ONCE'
        ? {}
        : { completedAt: { gte: start, lte: end } }),
    },
  });
  if (existing) throw alreadyCompleted();

  try {
    return await prisma.$transaction(async (tx) => {
      // Snapshot XP from the quest's current value. The unique
      // (quest_id, period_key) index makes concurrent completes race-safe.
      const entry = await tx.questEntry.create({
        data: {
          questId,
          userId,
          xpEarned: quest.xpReward,
          note: body.note?.trim() || null,
          periodKey: periodKey(quest.frequency, timezone),
        },
        include: { quest: { select: { id: true, title: true, difficulty: true, frequency: true } } },
      });

      // ONCE quests transition to COMPLETED after their single entry
      if (quest.frequency === 'ONCE') {
        await tx.quest.update({
          where: { id: questId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      return entry;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw alreadyCompleted();
    }
    throw err;
  }
}

// ── Feed (cursor-paginated) ───────────────────────────────────────────────
export async function getEntryFeed(userId: string, query: FeedQuery) {
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const entries = await prisma.questEntry.findMany({
    where: {
      userId,
      ...(query.quest_id && { questId: query.quest_id }),
      ...((query.from || query.to) && {
        completedAt: {
          ...(query.from && { gte: query.from }),
          ...(query.to && { lte: query.to }),
        },
      }),
      ...(cursor && {
        OR: [
          { completedAt: { lt: cursor.completedAt } },
          { completedAt: cursor.completedAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    include: {
      quest: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          frequency: true,
          category: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const hasMore = entries.length > query.limit;
  const page = hasMore ? entries.slice(0, query.limit) : entries;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ completedAt: last.completedAt, id: last.id }) : null;

  return { entries: page, nextCursor, hasMore };
}

// ── Single entry ──────────────────────────────────────────────────────────
export async function getEntryById(entryId: string, userId: string) {
  const entry = await prisma.questEntry.findUnique({
    where: { id: entryId },
    include: {
      quest: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          frequency: true,
          category: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
  if (!entry || entry.userId !== userId) throw Errors.notFound('Entry');
  return entry;
}

// ── Delete (undo) ─────────────────────────────────────────────────────────
export async function deleteEntry(entryId: string, userId: string) {
  const entry = await prisma.questEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw Errors.notFound('Entry');

  await prisma.$transaction(async (tx) => {
    await tx.questEntry.delete({ where: { id: entryId } });

    // Undoing the only completion of a ONCE quest reopens it
    const remaining = await tx.questEntry.count({ where: { questId: entry.questId } });
    if (remaining === 0) {
      await tx.quest.updateMany({
        where: { id: entry.questId, frequency: 'ONCE', status: 'COMPLETED' },
        data: { status: 'ACTIVE', completedAt: null },
      });
    }
  });
}

// ── XP/level summary (computed at read time) ──────────────────────────────
// Entries are the single source of truth for XP; users have no xp column.
export async function getUserTotalXp(userId: string): Promise<number> {
  const agg = await prisma.questEntry.aggregate({
    where: { userId },
    _sum: { xpEarned: true },
  });
  return agg._sum.xpEarned ?? 0;
}

export async function getUserXpSummary(userId: string) {
  return levelProgress(await getUserTotalXp(userId));
}

// ── Re-export for callers needing a streak ────────────────────────────────
export { calculateStreak };
