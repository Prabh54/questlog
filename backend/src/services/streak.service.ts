import { formatInTimeZone } from 'date-fns-tz';

export type Frequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface StreakInput {
  completedAt: Date;
}

export interface StreakResult {
  current: number;
  longest: number;
  totalCompletions: number;
}

// ── Bucket-key helpers ────────────────────────────────────────────────────
// All buckets are represented as strings so they can be compared / set-membered.

function dayKey(date: Date, tz: string): string {
  // YYYY-MM-DD in user's timezone
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

function weekKey(date: Date, tz: string): string {
  // ISO week year + week number: 2026-W20
  return formatInTimeZone(date, tz, "RRRR-'W'II");
}

function bucketFor(freq: Frequency): (d: Date, tz: string) => string {
  return freq === 'WEEKLY' ? weekKey : dayKey;
}

// "Previous bucket" — yesterday for daily, last ISO week for weekly.
function previousBucket(currentBucket: string, freq: Frequency, tz: string): string {
  // Step the calendar date back by 1 day (daily) or 7 days (weekly), re-key.
  // Parse currentBucket back to a Date in UTC anchored to midnight of that bucket.
  // For daily: parse YYYY-MM-DD as UTC midnight.
  // For weekly: pick the Monday of that ISO week in UTC.
  if (freq === 'WEEKLY') {
    const [yStr, wStr] = currentBucket.split('-W');
    const isoYear = Number(yStr);
    const isoWeek = Number(wStr);
    // Monday of given ISO week, UTC
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // 1..7 with Sun=7
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
    const targetMonday = new Date(mondayOfWeek1);
    targetMonday.setUTCDate(targetMonday.getUTCDate() + (isoWeek - 1) * 7);
    // Step one week back
    targetMonday.setUTCDate(targetMonday.getUTCDate() - 7);
    return weekKey(targetMonday, tz);
  }

  // Daily
  const [y, m, d] = currentBucket.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return dayKey(date, tz);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Calculate streak statistics over a list of completion entries.
 *
 *   - Entries are normalized to local calendar day (DAILY) or ISO week (WEEKLY)
 *   - Multiple entries in the same bucket collapse to one
 *   - Current streak: walks backwards from today; if today has no completion
 *     but yesterday does, the grace period kicks in and the streak starts at
 *     yesterday's bucket
 *   - Longest streak: maximum consecutive run across the full deduped list
 *
 * Pure function — pass `now` for deterministic tests.
 */
export function calculateStreak(
  entries: StreakInput[],
  frequency: Frequency,
  timezone: string,
  now: Date = new Date(),
): StreakResult {
  // ONCE: degenerate — at most one meaningful completion
  if (frequency === 'ONCE') {
    return {
      current: entries.length > 0 ? 1 : 0,
      longest: entries.length > 0 ? 1 : 0,
      totalCompletions: entries.length,
    };
  }

  // MONTHLY: not a streak metric — count completions
  if (frequency === 'MONTHLY') {
    return { current: 0, longest: 0, totalCompletions: entries.length };
  }

  const bucket = bucketFor(frequency);
  const buckets = new Set<string>();
  for (const e of entries) buckets.add(bucket(e.completedAt, timezone));

  const totalCompletions = buckets.size;
  if (totalCompletions === 0) return { current: 0, longest: 0, totalCompletions: 0 };

  // ── Current ─────────────────────────────────────────────────────────────
  const todayBucket = bucket(now, timezone);
  const yesterdayBucket = previousBucket(todayBucket, frequency, timezone);

  let cursor: string | null = null;
  if (buckets.has(todayBucket)) cursor = todayBucket;
  else if (buckets.has(yesterdayBucket)) cursor = yesterdayBucket; // grace period

  let current = 0;
  while (cursor && buckets.has(cursor)) {
    current++;
    cursor = previousBucket(cursor, frequency, timezone);
  }

  // ── Longest ─────────────────────────────────────────────────────────────
  // Sort ascending, then walk and count consecutive runs.
  const sorted = [...buckets].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const b of sorted) {
    if (prev !== null && previousBucket(b, frequency, timezone) === prev) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = b;
  }

  return { current, longest, totalCompletions };
}
