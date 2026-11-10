/**
 * Per-user aggregates computed inside Postgres.
 *
 * These used to load every completion of the user into Node (≈8.5k rows for a
 * three-year user) and bucket them with Intl-based timezone formatting, which
 * pinned the single Node thread under load. Each query now returns at most one
 * row per quest / bucket / category, answered by index-only scans on
 * quest_entries(user_id, completed_at DESC, quest_id, xp_earned).
 *
 * Local days and weeks are computed in Node (utils/local-buckets) and passed
 * in as arrays of UTC bucket starts; Postgres assigns rows with width_bucket(),
 * so the database's own tz rules are never consulted (see local-buckets.ts).
 *
 * Semantics are pinned to the original TypeScript (calculateStreak, and the
 * JS bucketing analytics.service used); __tests__/stats-equivalence compares
 * the two on randomized histories across timezones.
 */
import { Prisma, type QuestFrequency } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { StreakResult } from './streak.service';
import { localBuckets, localDate, type Buckets } from '../utils/local-buckets';

/** completed_at (UTC, stored without zone) as a timestamptz, without consulting tz rules. */
const completedAt = Prisma.sql`(e.completed_at AT TIME ZONE 'UTC')`;

/**
 * A JS Date as a UTC timestamp comparable with completed_at. Passed as an ISO
 * string so the result never depends on the connection's TimeZone setting.
 */
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/**
 * The bucket starts as a timestamptz[]. Wrapped in a scalar subquery so the
 * text → timestamptz[] cast runs once per query (an InitPlan), not once per
 * row: inline, a 1,100-element cast per row made streaks 10× slower.
 */
const startsArray = (b: Buckets) =>
  Prisma.sql`(SELECT ${b.starts.map((d) => d.toISOString())}::timestamptz[])`;

/** 1-based bucket number of a row: i means starts[i-1] ≤ t < starts[i]. */
const bucketOf = (b: Buckets) => Prisma.sql`width_bucket(${completedAt}, ${startsArray(b)})`;

// ── Streaks ────────────────────────────────────────────────────────────────

interface StreakRow {
  quest_id: string;
  current: number;
  longest: number;
  total: number;
}

const STREAK_FREQUENCIES: QuestFrequency[] = ['DAILY', 'WEEKLY'];

/**
 * Current / longest streak and total completions for each of the user's
 * quests (or only `questIds`). Same rules as calculateStreak():
 *  - DAILY buckets by local day, WEEKLY by ISO week; repeats in a bucket collapse
 *  - current = run ending in this bucket, or in the previous one (grace period)
 *  - ONCE: 1/1 if completed; MONTHLY: no streak, just the count
 *
 * Consecutive buckets have consecutive numbers, so runs ("islands") are found
 * with the gaps-and-islands trick: bucket − row_number() is constant in a run.
 */
export async function streakStats(
  userId: string,
  timezone: string,
  questIds?: string[],
  now = new Date(),
): Promise<Map<string, StreakResult>> {
  if (questIds && questIds.length === 0) return new Map();
  const questFilter = questIds ? Prisma.sql`AND q.id IN (${Prisma.join(questIds)})` : Prisma.empty;

  // Buckets from the first streak-relevant completion up to today
  const first = await prisma.questEntry.findFirst({
    where: {
      userId,
      quest: { frequency: { in: STREAK_FREQUENCIES }, ...(questIds && { id: { in: questIds } }) },
    },
    orderBy: { completedAt: 'asc' },
    select: { completedAt: true },
  });
  const today = localDate(now, timezone);
  const from = first ? localDate(first.completedAt, timezone) : today;
  const days = localBuckets('day', timezone, from < today ? from : today, today);
  const weeks = localBuckets('week', timezone, from < today ? from : today, today);

  const rows = await prisma.$queryRaw<StreakRow[]>`
    WITH quests_in_scope AS (
      SELECT q.id, q.frequency FROM quests q
      WHERE q.user_id = ${userId} ${questFilter}
    ),
    buckets AS (
      SELECT DISTINCT e.quest_id,
             CASE qs.frequency WHEN 'WEEKLY' THEN ${bucketOf(weeks)} ELSE ${bucketOf(days)} END AS bucket,
             CASE qs.frequency WHEN 'WEEKLY' THEN ${weeks.keys.length}::int ELSE ${days.keys.length}::int END AS this_bucket
      FROM quest_entries e
      JOIN quests_in_scope qs ON qs.id = e.quest_id
      WHERE e.user_id = ${userId} AND qs.frequency IN ('DAILY', 'WEEKLY')
    ),
    islands AS (
      SELECT quest_id, this_bucket, min(bucket) AS first_bucket, max(bucket) AS last_bucket,
             count(*)::int AS len
      FROM (
        SELECT b.*, b.bucket - row_number() OVER (PARTITION BY b.quest_id ORDER BY b.bucket) AS run
        FROM buckets b
      ) runs
      GROUP BY quest_id, this_bucket, run
    ),
    streaks AS (
      SELECT quest_id,
             max(len)::int AS longest,
             sum(len)::int AS total,
             coalesce(max(CASE
               -- run contains this bucket: count from its start up to this bucket
               WHEN first_bucket <= this_bucket AND last_bucket >= this_bucket
                 THEN this_bucket - first_bucket + 1
               -- grace period: nothing this bucket yet, run includes the previous one
               WHEN first_bucket <= this_bucket - 1 AND last_bucket >= this_bucket - 1
                 THEN this_bucket - first_bucket
             END), 0)::int AS current
      FROM islands
      GROUP BY quest_id
    ),
    counted AS (
      SELECT e.quest_id, qs.frequency, count(*)::int AS n
      FROM quest_entries e
      JOIN quests_in_scope qs ON qs.id = e.quest_id
      WHERE e.user_id = ${userId} AND qs.frequency IN ('ONCE', 'MONTHLY')
      GROUP BY e.quest_id, qs.frequency
    )
    SELECT quest_id, current, longest, total FROM streaks
    UNION ALL
    SELECT quest_id,
           CASE WHEN frequency = 'ONCE' THEN 1 ELSE 0 END,
           CASE WHEN frequency = 'ONCE' THEN 1 ELSE 0 END,
           n
    FROM counted
  `;

  return new Map(
    rows.map((r) => [r.quest_id, { current: r.current, longest: r.longest, totalCompletions: r.total }]),
  );
}

export const EMPTY_STREAK: StreakResult = { current: 0, longest: 0, totalCompletions: 0 };

// ── Per-bucket totals ─────────────────────────────────────────────────────

/** Completions and XP in each bucket (keyed by bucket key; empty buckets omitted). */
export async function totalsByBucket(
  userId: string,
  buckets: Buckets,
): Promise<Map<string, { count: number; xp: number }>> {
  if (buckets.keys.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ bucket: number; count: number; xp: number }[]>`
    SELECT ${bucketOf(buckets)} AS bucket,
           count(*)::int AS count,
           coalesce(sum(e.xp_earned), 0)::int AS xp
    FROM quest_entries e
    WHERE e.user_id = ${userId}
      AND e.completed_at >= ${utc(buckets.starts[0])}
      AND e.completed_at < ${utc(buckets.starts[buckets.starts.length - 1])}
    GROUP BY 1
  `;
  return new Map(rows.map((r) => [buckets.keys[r.bucket - 1], { count: r.count, xp: r.xp }]));
}

/** Local days (bucket keys) on which each quest was completed, within `days`. */
export async function completedDays(
  userId: string,
  questIds: string[],
  days: Buckets,
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (questIds.length === 0 || days.keys.length === 0) return result;
  const rows = await prisma.$queryRaw<{ quest_id: string; bucket: number }[]>`
    SELECT DISTINCT e.quest_id, ${bucketOf(days)} AS bucket
    FROM quest_entries e
    WHERE e.user_id = ${userId}
      AND e.quest_id IN (${Prisma.join(questIds)})
      AND e.completed_at >= ${utc(days.starts[0])}
      AND e.completed_at < ${utc(days.starts[days.starts.length - 1])}
  `;
  for (const { quest_id, bucket } of rows) {
    const set = result.get(quest_id) ?? new Set<string>();
    set.add(days.keys[bucket - 1]);
    result.set(quest_id, set);
  }
  return result;
}

/** XP earned before `beforeUtc` (the cumulative baseline of an XP chart). */
export async function xpBefore(userId: string, beforeUtc: Date): Promise<number> {
  const agg = await prisma.questEntry.aggregate({
    where: { userId, completedAt: { lt: beforeUtc } },
    _sum: { xpEarned: true },
  });
  return agg._sum.xpEarned ?? 0;
}

// ── Categories ────────────────────────────────────────────────────────────

export interface CategoryTotalsRow {
  category_id: string | null;
  name: string | null;
  color: string | null;
  completions: number;
  xp: number;
}

export async function totalsByCategory(userId: string): Promise<CategoryTotalsRow[]> {
  return prisma.$queryRaw<CategoryTotalsRow[]>`
    SELECT c.id AS category_id, c.name, c.color,
           count(*)::int AS completions,
           coalesce(sum(e.xp_earned), 0)::int AS xp
    FROM quest_entries e
    JOIN quests q ON q.id = e.quest_id AND q.user_id = ${userId}
    LEFT JOIN categories c ON c.id = q.category_id
    WHERE e.user_id = ${userId}
    GROUP BY c.id, c.name, c.color
  `;
}
