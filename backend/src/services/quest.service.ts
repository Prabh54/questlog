import { Prisma, QuestStatus } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../db/prisma';
import { Errors } from '../lib/errors';
import { calculateStreak } from './streak.service';
import type {
  CreateQuestBody,
  ListQuestsQuery,
  UpdateQuestBody,
} from '../validators/quest.validators';

// ── Shape returned to the client ─────────────────────────────────────────
type StripDay = { date: string; completed: boolean };

const STRIP_DAYS = 14;

/** Build the last-14-days strip (binary: completed or not) in user's TZ. */
function buildStrip(
  entries: { completedAt: Date }[],
  timezone: string,
  now = new Date(),
): StripDay[] {
  const days = new Set<string>();
  for (const e of entries) {
    days.add(formatInTimeZone(e.completedAt, timezone, 'yyyy-MM-dd'));
  }

  const strip: StripDay[] = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = formatInTimeZone(d, timezone, 'yyyy-MM-dd');
    strip.push({ date: key, completed: days.has(key) });
  }
  return strip;
}

type QuestWithRelations = Prisma.QuestGetPayload<{
  include: { category: true; entries: { take: number; orderBy: { completedAt: 'desc' } } };
}>;

function decorate(quest: QuestWithRelations, timezone: string) {
  const strip = buildStrip(quest.entries, timezone);
  const { current: streak, longest, totalCompletions } = calculateStreak(
    quest.entries,
    quest.frequency,
    timezone,
  );

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
    streak,
    longest_streak: longest,
    total_completions: totalCompletions,
    strip,
    created_at: quest.createdAt,
    updated_at: quest.updatedAt,
  };
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
      include: {
        category: true,
        entries: { orderBy: { completedAt: 'desc' }, take: 60 },
      },
    }),
  ]);

  return quests.map((q) => decorate(q, timezone));
}

// ── Get one ───────────────────────────────────────────────────────────────
export async function getQuestById(questId: string, userId: string) {
  const [timezone, quest] = await Promise.all([
    getTimezone(userId),
    prisma.quest.findUnique({
      where: { id: questId },
      include: {
        category: true,
        entries: { orderBy: { completedAt: 'desc' }, take: 60 },
      },
    }),
  ]);
  if (!quest || quest.userId !== userId) throw Errors.notFound('Quest');
  return decorate(quest, timezone);
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
      include: {
        category: true,
        entries: { orderBy: { completedAt: 'desc' }, take: 60 },
      },
    }),
  ]);
  return decorate(quest, timezone);
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
      include: {
        category: true,
        entries: { orderBy: { completedAt: 'desc' }, take: 60 },
      },
    }),
  ]);
  return decorate(quest, timezone);
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
      include: {
        category: true,
        entries: { orderBy: { completedAt: 'desc' }, take: 60 },
      },
    }),
  ]);
  return decorate(quest, timezone);
}

export const archiveQuest = (questId: string, userId: string) =>
  setStatus(questId, userId, QuestStatus.ARCHIVED);

export const unarchiveQuest = (questId: string, userId: string) =>
  setStatus(questId, userId, QuestStatus.ACTIVE);
