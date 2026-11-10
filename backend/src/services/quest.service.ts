import { Prisma, QuestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { Errors } from '../lib/errors';
import { EMPTY_STREAK, completedDays, streakStats } from './stats.queries';
import { addDays, localBuckets, localDate } from '../utils/local-buckets';
import type {
  CreateQuestBody,
  ListQuestsQuery,
  UpdateQuestBody,
} from '@questlog/shared';

// ── Shape returned to the client ─────────────────────────────────────────
const STRIP_DAYS = 14;

type QuestWithCategory = Prisma.QuestGetPayload<{ include: { category: true } }>;

/**
 * Adds streak stats and the 14-day strip to quests. Two aggregate queries for
 * the whole list, instead of loading every completion of every quest (Prisma
 * applies a nested `take` in memory, after fetching all rows).
 */
async function decorate(quests: QuestWithCategory[], userId: string, timezone: string) {
  const now = new Date();
  const ids = quests.map((q) => q.id);
  // The 14-day strip: the last 14 local days, oldest first
  const today = localDate(now, timezone);
  const stripDays = localBuckets('day', timezone, addDays(today, -(STRIP_DAYS - 1)), today);
  const [streaks, recentDays] = await Promise.all([
    streakStats(userId, timezone, ids, now),
    completedDays(userId, ids, stripDays),
  ]);

  return quests.map((quest) => {
    const { current, longest, totalCompletions } = streaks.get(quest.id) ?? EMPTY_STREAK;
    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      status: quest.status,
      difficulty: quest.difficulty,
      frequency: quest.frequency,
      xp_reward: quest.xpReward,
      is_active: quest.status === 'ACTIVE',
      due_date: quest.dueDate,
      completed_at: quest.completedAt,
      category: quest.category,
      streak: current,
      longest_streak: longest,
      total_completions: totalCompletions,
      strip: stripDays.keys.map((date) => ({
        date,
        completed: recentDays.get(quest.id)?.has(date) ?? false,
      })),
      created_at: quest.createdAt,
      updated_at: quest.updatedAt,
    };
  });
}

async function decorateOne(quest: QuestWithCategory, userId: string, timezone: string) {
  const [decorated] = await decorate([quest], userId, timezone);
  return decorated;
}

async function getTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return user?.timezone ?? 'UTC';
}

// ── List ──────────────────────────────────────────────────────────────────
export async function listQuests(userId: string, query: ListQuestsQuery) {
  const where: Prisma.QuestWhereInput = {
    userId,
    ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
    ...(query.category_id && { categoryId: query.category_id }),
    ...(query.difficulty && { difficulty: query.difficulty }),
    ...(query.frequency && { frequency: query.frequency }),
    ...(query.status && { status: query.status }),
  };

  const orderBy: Prisma.QuestOrderByWithRelationInput =
    query.sort === 'oldest'
      ? { createdAt: 'asc' }
      : query.sort === 'xp_desc'
        ? { xpReward: 'desc' }
        : query.sort === 'xp_asc'
          ? { xpReward: 'asc' }
          : query.sort === 'title'
            ? { title: 'asc' }
            : { createdAt: 'desc' };

  const [timezone, quests] = await Promise.all([
    getTimezone(userId),
    prisma.quest.findMany({
      where,
      orderBy,
      include: { category: true },
    }),
  ]);

  return decorate(quests, userId, timezone);
}

// ── Get one ───────────────────────────────────────────────────────────────
export async function getQuestById(questId: string, userId: string) {
  const [timezone, quest] = await Promise.all([
    getTimezone(userId),
    prisma.quest.findUnique({
      where: { id: questId },
      include: { category: true },
    }),
  ]);
  if (!quest || quest.userId !== userId) throw Errors.notFound('Quest');
  return decorateOne(quest, userId, timezone);
}

// ── Create ────────────────────────────────────────────────────────────────
export async function createQuest(userId: string, body: CreateQuestBody) {
  if (body.category_id) {
    const cat = await prisma.category.findUnique({ where: { id: body.category_id } });
    if (!cat || cat.userId !== userId) throw Errors.notFound('Category');
  }

  const [timezone, quest] = await Promise.all([
    getTimezone(userId),
    prisma.quest.create({
      data: {
        userId,
        title: body.title,
        description: body.description ?? null,
        difficulty: body.difficulty,
        frequency: body.frequency,
        xpReward: body.xp_reward,
        categoryId: body.category_id ?? null,
        status: body.is_active ? QuestStatus.ACTIVE : QuestStatus.PAUSED,
      },
      include: { category: true },
    }),
  ]);
  return decorateOne(quest, userId, timezone);
}

// ── Update ────────────────────────────────────────────────────────────────
export async function updateQuest(
  questId: string,
  userId: string,
  body: UpdateQuestBody,
) {
  const existing = await prisma.quest.findUnique({ where: { id: questId } });
  if (!existing || existing.userId !== userId) throw Errors.notFound('Quest');

  if (body.category_id) {
    const cat = await prisma.category.findUnique({ where: { id: body.category_id } });
    if (!cat || cat.userId !== userId) throw Errors.notFound('Category');
  }

  // Map is_active → status only when current status is ACTIVE / PAUSED
  let nextStatus: QuestStatus | undefined;
  if (
    body.is_active !== undefined &&
    existing.status !== 'ARCHIVED' &&
    existing.status !== 'COMPLETED'
  ) {
    nextStatus = body.is_active ? QuestStatus.ACTIVE : QuestStatus.PAUSED;
  }

  const [timezone, quest] = await Promise.all([
    getTimezone(userId),
    prisma.quest.update({
      where: { id: questId },
      data: {
        title: body.title ?? undefined,
        description: body.description === undefined ? undefined : body.description,
        difficulty: body.difficulty ?? undefined,
        frequency: body.frequency ?? undefined,
        xpReward: body.xp_reward ?? undefined,
        categoryId: body.category_id === undefined ? undefined : body.category_id,
        ...(nextStatus && { status: nextStatus }),
      },
      include: { category: true },
    }),
  ]);
  return decorateOne(quest, userId, timezone);
}

// ── Delete ────────────────────────────────────────────────────────────────
export async function deleteQuest(questId: string, userId: string) {
  const existing = await prisma.quest.findUnique({ where: { id: questId } });
  if (!existing || existing.userId !== userId) throw Errors.notFound('Quest');
  await prisma.quest.delete({ where: { id: questId } });
}

// ── Archive / Unarchive ───────────────────────────────────────────────────
async function setStatus(questId: string, userId: string, status: QuestStatus) {
  const existing = await prisma.quest.findUnique({ where: { id: questId } });
  if (!existing || existing.userId !== userId) throw Errors.notFound('Quest');

  const [timezone, quest] = await Promise.all([
    getTimezone(userId),
    prisma.quest.update({
      where: { id: questId },
      data: { status },
      include: { category: true },
    }),
  ]);
  return decorateOne(quest, userId, timezone);
}

export const archiveQuest = (questId: string, userId: string) =>
  setStatus(questId, userId, QuestStatus.ARCHIVED);

export const unarchiveQuest = (questId: string, userId: string) =>
  setStatus(questId, userId, QuestStatus.ACTIVE);
