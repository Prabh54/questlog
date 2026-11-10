import { prisma } from '../db/prisma';
import { Errors } from '../lib/errors';
import { todayBoundaries } from '../utils/dates';
import type { Frequency } from './streak.service';
import { calculateLevel, levelProgress } from './xp.service';
import {
  EMPTY_STREAK,
  streakStats,
  totalsByBucket,
  totalsByCategory,
  xpBefore,
} from './stats.queries';
import { localBuckets, localDate } from '../utils/local-buckets';

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

  const streaks = await streakStats(
    userId,
    timezone,
    activeQuests.map((q: typeof activeQuests[0]) => q.id),
  );
  let bestStreak = 0;
  for (const { current } of streaks.values()) bestStreak = Math.max(bestStreak, current);

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

  const buckets = localBuckets(
    bucket,
    timezone,
    localDate(startDate, timezone),
    localDate(new Date(), timezone),
  );
  const totals = await totalsByBucket(userId, buckets);

  const series = buckets.keys.map((date) => ({ date, count: totals.get(date)?.count ?? 0 }));

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

  const streaks = await streakStats(userId, timezone);

  let bestCurrent = 0;
  let bestLongest = 0;
  const result: PerQuestStreak[] = quests.map((q: typeof quests[0]) => {
    const { current, longest, totalCompletions } = streaks.get(q.id) ?? EMPTY_STREAK;
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
  const rows = await totalsByCategory(userId);
  const total = rows.reduce((sum, r) => sum + r.completions, 0);

  const categories: CategoryBreakdownRow[] = rows
    .map((r) => ({
      categoryId: r.category_id,
      name: r.name ?? 'Uncategorized',
      color: r.color ?? '#475569',
      completions: r.completions,
      xp: r.xp,
      pctOfTotal: total > 0 ? Math.round((r.completions / total) * 1000) / 10 : 0,
    }))
    // Ties broken by name so the order is deterministic
    .sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name));

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

  const first = await prisma.questEntry.findFirst({
    where: { userId },
    orderBy: { completedAt: 'asc' },
    select: { completedAt: true },
  });
  if (!first) return { range, bucket, series: [] };

  let startDate: Date;
  if (range === 'all') {
    startDate = first.completedAt;
  } else {
    const now = new Date();
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - (RANGE_DAYS[range] - 1));
  }
  const buckets = localBuckets(
    bucket,
    timezone,
    localDate(startDate, timezone),
    localDate(new Date(), timezone),
  );

  // Carry-over: XP earned before the visible range starts
  const [baseline, totals] = await Promise.all([
    xpBefore(userId, buckets.starts[0]),
    totalsByBucket(userId, buckets),
  ]);

  let cumulative = baseline;
  const series: XpTimeSeriesPoint[] = buckets.keys.map((key) => {
    const earned = totals.get(key)?.xp ?? 0;
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
