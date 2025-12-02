import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../db/prisma';
import { Errors } from '../lib/errors';
import { todayBoundaries } from '../utils/dates';
import { calculateStreak, type Frequency } from './streak.service';
import { calculateLevel, levelProgress } from './xp.service';

// ╔═══ Dashboard summary ═══════════════════════════════════════════════════╗

export interface DashboardSummary {
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  xpProgress: number;
  todayCompletionPct: number;
  activeQuestCount: number;
  bestStreak: number;
  todayQuests: TodayQuest[];
}

interface TodayQuest {
  id: string;
  title: string;
  difficulty: string;
  xp_reward: number;
  category: { id: string; name: string; color: string } | null;
  completedToday: boolean;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const timezone = await loadTimezone(userId);

  const [xpAgg, activeQuests, todayEntries] = await Promise.all([
    prisma.questEntry.aggregate({ where: { userId }, _sum: { xpEarned: true } }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    (async () => {
      const { start, end } = todayBoundaries(timezone);
      return prisma.questEntry.findMany({
        where: { userId, completedAt: { gte: start, lte: end } },
        select: { questId: true },
      });
    })(),
  ]);

  const totalXp = xpAgg._sum.xpEarned ?? 0;
  const progress = levelProgress(totalXp);
  const completedToday = new Set(todayEntries.map((e: typeof todayEntries[0]) => e.questId));

  const dailyQuests = activeQuests.filter((q: typeof activeQuests[0]) => q.frequency === 'DAILY');
  const todayQuests: TodayQuest[] = dailyQuests.map((q: typeof activeQuests[0]) => ({
    id: q.id,
    title: q.title,
    difficulty: q.difficulty,
    xp_reward: q.xpReward,
    category: q.category,
    completedToday: completedToday.has(q.id),
  }));
  const dailyDone = todayQuests.filter((q) => q.completedToday).length;
  const todayCompletionPct =
    dailyQuests.length > 0 ? Math.round((dailyDone / dailyQuests.length) * 100) : 0;

  let bestStreak = 0;
  if (activeQuests.length > 0) {
    const byQuest = await loadEntriesGroupedByQuest(userId, activeQuests.map((q: typeof activeQuests[0]) => q.id));
    for (const q of activeQuests) {
      const { current } = calculateStreak(
        byQuest.get(q.id) ?? [],
        q.frequency,
        timezone,
      );
      if (current > bestStreak) bestStreak = current;
    }
  }

  return {
    totalXp,
    level: progress.level,
    xpInLevel: progress.xpInLevel,
    xpToNext: progress.xpToNext,
    xpProgress: progress.progress,
    todayCompletionPct,
    activeQuestCount: activeQuests.length,
    bestStreak,
    todayQuests,
  };
}

// ╔═══ Completion time series (range × bucket) ═════════════════════════════╗

export type Range = '7d' | '30d' | '90d' | '365d' | 'all';
export type Bucket = 'day' | 'week';

const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD for 'day', Monday-of-week YYYY-MM-DD for 'week'
  count: number;
}

export interface CompletionTimeSeriesResult {
  range: Range;
  bucket: Bucket;
  series: TimeSeriesPoint[];
}

export async function getCompletionTimeSeries(
  userId: string,
  range: Range = '30d',
  bucket: Bucket = 'day',
): Promise<CompletionTimeSeriesResult> {
  const timezone = await loadTimezone(userId);

  let startDate: Date;
  if (range === 'all') {
    const first = await prisma.questEntry.findFirst({
      where: { userId },
      orderBy: { completedAt: 'asc' },
      select: { completedAt: true },
    });
    if (!first) return { range, bucket, series: [] };
    startDate = first.completedAt;
  } else {
    const now = new Date();
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - (RANGE_DAYS[range] - 1));
  }

  const { start: fromUtc } = todayBoundaries(timezone, startDate);

  const rows = await prisma.questEntry.findMany({
    where: { userId, completedAt: { gte: fromUtc } },
    select: { completedAt: true },
    orderBy: { completedAt: 'asc' },
  });

  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.completedAt, bucket, timezone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series = enumerateSlots(fromUtc, new Date(), bucket, timezone).map((date) => ({
    date,
    count: counts.get(date) ?? 0,
  }));

  return { range, bucket, series };
}

// ╔═══ Streak summary (per-quest) ══════════════════════════════════════════╗

export interface PerQuestStreak {
  questId: string;
  questTitle: string;
  difficulty: string;
  frequency: Frequency;
  category: { id: string; name: string; color: string } | null;
  current: number;
  longest: number;
  totalCompletions: number;
}

export async function getStreakSummary(userId: string): Promise<{
  quests: PerQuestStreak[];
  best: { current: number; longest: number };
}> {
  const timezone = await loadTimezone(userId);

  const quests = await prisma.quest.findMany({
    where: { userId },
    include: { category: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (quests.length === 0) {
    return { quests: [], best: { current: 0, longest: 0 } };
  }

  const byQuest = await loadEntriesGroupedByQuest(userId, quests.map((q: typeof quests[0]) => q.id));

  let bestCurrent = 0;
  let bestLongest = 0;
  const result: PerQuestStreak[] = quests.map((q: typeof quests[0]) => {
    const { current, longest, totalCompletions } = calculateStreak(
      byQuest.get(q.id) ?? [],
      q.frequency,
      timezone,
    );
    if (current > bestCurrent) bestCurrent = current;
    if (longest > bestLongest) bestLongest = longest;
    return {
      questId: q.id,
      questTitle: q.title,
      difficulty: q.difficulty,
      frequency: q.frequency,
      category: q.category,
      current,
      longest,
      totalCompletions,
    };
  });

  return { quests: result, best: { current: bestCurrent, longest: bestLongest } };
}

// ╔═══ Category breakdown ══════════════════════════════════════════════════╗

export interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  color: string;
  completions: number;
  xp: number;
  pctOfTotal: number; // 0..100
}

export async function getCategoryBreakdown(userId: string): Promise<{
  categories: CategoryBreakdownRow[];
  total: number;
}> {
  const entries = await prisma.questEntry.findMany({
    where: { userId },
    select: {
      xpEarned: true,
      quest: {
        select: { category: { select: { id: true, name: true, color: true } } },
      },
    },
  });

  type Agg = { name: string; color: string; completions: number; xp: number };
  const map = new Map<string, Agg>();

  for (const e of entries) {
    const cat = e.quest.category;
    const key = cat?.id ?? '__none__';
    const existing = map.get(key) ?? {
      name: cat?.name ?? 'Uncategorized',
      color: cat?.color ?? '#475569',
      completions: 0,
      xp: 0,
    };
    existing.completions += 1;
    existing.xp += e.xpEarned;
    map.set(key, existing);
  }

  const total = entries.length;
  const categories: CategoryBreakdownRow[] = [...map.entries()]
    .map(([key, agg]) => ({
      categoryId: key === '__none__' ? null : key,
      name: agg.name,
      color: agg.color,
      completions: agg.completions,
      xp: agg.xp,
      pctOfTotal: total > 0 ? Math.round((agg.completions / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.completions - a.completions);

  return { categories, total };
}

// ╔═══ XP time series (cumulative + level history) ═════════════════════════╗

export interface XpTimeSeriesPoint {
  date: string;
  xp: number;          // XP earned this bucket
  cumulativeXp: number;
  level: number;
}

export interface XpTimeSeriesResult {
  range: Range;
  bucket: Bucket;
  series: XpTimeSeriesPoint[];
}

export async function getXpTimeSeries(
  userId: string,
  range: Range = '30d',
  bucket: Bucket = 'day',
): Promise<XpTimeSeriesResult> {
  const timezone = await loadTimezone(userId);

  // Need every prior entry to compute the cumulative baseline at range start
  const allEntries = await prisma.questEntry.findMany({
    where: { userId },
    select: { completedAt: true, xpEarned: true },
    orderBy: { completedAt: 'asc' },
  });
  if (allEntries.length === 0) return { range, bucket, series: [] };

  let startDate: Date;
  if (range === 'all') {
    startDate = allEntries[0].completedAt;
  } else {
    const now = new Date();
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - (RANGE_DAYS[range] - 1));
  }
  const { start: fromUtc } = todayBoundaries(timezone, startDate);

  // Carry-over: XP earned before the visible range starts
  let cumulative = 0;
  const xpByBucket = new Map<string, number>();
  for (const e of allEntries) {
    if (e.completedAt < fromUtc) {
      cumulative += e.xpEarned;
      continue;
    }
    const key = bucketKey(e.completedAt, bucket, timezone);
    xpByBucket.set(key, (xpByBucket.get(key) ?? 0) + e.xpEarned);
  }

  const series: XpTimeSeriesPoint[] = enumerateSlots(
    fromUtc,
    new Date(),
    bucket,
    timezone,
  ).map((key) => {
    const earned = xpByBucket.get(key) ?? 0;
    cumulative += earned;
    return { date: key, xp: earned, cumulativeXp: cumulative, level: calculateLevel(cumulative) };
  });

  return { range, bucket, series };
}

// ╔═══ Internal helpers ════════════════════════════════════════════════════╗

async function loadTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) throw Errors.notFound('User');
  return user.timezone;
}

async function loadEntriesGroupedByQuest(
  userId: string,
  questIds: string[],
): Promise<Map<string, { completedAt: Date }[]>> {
  const all = await prisma.questEntry.findMany({
    where: { userId, questId: { in: questIds } },
    select: { questId: true, completedAt: true },
    orderBy: { completedAt: 'desc' },
  });
  const map = new Map<string, { completedAt: Date }[]>();
  for (const e of all) {
    const list = map.get(e.questId) ?? [];
    list.push({ completedAt: e.completedAt });
    map.set(e.questId, list);
  }
  return map;
}

function bucketKey(date: Date, bucket: Bucket, tz: string): string {
  if (bucket === 'week') {
    // Monday of the ISO week containing `date`, as YYYY-MM-DD
    const yyyymmdd = formatInTimeZone(date, tz, 'yyyy-MM-dd');
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d));
    const jsDay = anchor.getUTCDay(); // 0=Sun..6=Sat
    const back = jsDay === 0 ? 6 : jsDay - 1;
    anchor.setUTCDate(anchor.getUTCDate() - back);
    return anchor.toISOString().slice(0, 10);
  }
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

function enumerateSlots(from: Date, until: Date, bucket: Bucket, tz: string): string[] {
  const slots: string[] = [];
  const seen = new Set<string>();
  const cursor = new Date(from);
  while (cursor <= until) {
    const key = bucketKey(cursor, bucket, tz);
    if (!seen.has(key)) {
      seen.add(key);
      slots.push(key);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}
