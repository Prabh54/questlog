/**
 * Local calendar buckets (days or ISO weeks) as UTC instants.
 *
 * Timezone rules come from exactly one place: Node's ICU data, which also
 * drives periodKey() and every other date helper. SQL never evaluates
 * `AT TIME ZONE <user tz>`, because the database ships its own tz database:
 * when the two disagree (e.g. tzdata 2026b in Postgres vs 2026a in Node, for
 * British Columbia's 2026 rule change) the same completion could land on
 * different local days in different parts of the app. Instead, we compute
 * the UTC start of every local bucket here and Postgres assigns rows with
 * width_bucket(completed_at, starts).
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export type BucketKind = 'day' | 'week';

export interface Buckets {
  /** YYYY-MM-DD of each bucket: the local day, or the Monday of the ISO week */
  keys: string[];
  /**
   * keys.length + 1 ascending UTC instants: starts[i] ≤ t < starts[i+1] means
   * t falls in bucket i. The extra last instant closes the final bucket.
   */
  starts: Date[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD ± n calendar days (pure calendar math, no timezone). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing a YYYY-MM-DD date. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -(jsDay === 0 ? 6 : jsDay - 1));
}

export function localDate(at: Date, timezone: string): string {
  return formatInTimeZone(at, timezone, 'yyyy-MM-dd');
}

// Bucket starts depend only on (timezone, date): cache them across requests.
const startCache = new Map<string, number>();
const START_CACHE_LIMIT = 100_000;

/** The first instant whose local date in `timezone` is `date`. */
export function localDayStart(date: string, timezone: string): Date {
  const cacheKey = `${timezone}|${date}`;
  const cached = startCache.get(cacheKey);
  if (cached !== undefined) return new Date(cached);

  let t = fromZonedTime(`${date}T00:00:00`, timezone).getTime();
  // Zones whose DST switch happens at midnight have no 00:00 on that day:
  // settle on the earliest instant that formats as `date`.
  const STEP = 15 * 60 * 1000;
  while (localDate(new Date(t), timezone) < date) t += STEP;
  while (localDate(new Date(t - STEP), timezone) === date) t -= STEP;

  if (startCache.size >= START_CACHE_LIMIT) startCache.clear();
  startCache.set(cacheKey, t);
  return new Date(t);
}

/**
 * Consecutive local buckets covering local dates `fromDate`..`toDate`
 * (inclusive). A week bucket is keyed by its Monday, but the first one starts
 * at `fromDate` itself, so nothing before the range is counted.
 */
export function localBuckets(
  kind: BucketKind,
  timezone: string,
  fromDate: string,
  toDate: string,
): Buckets {
  const step = kind === 'week' ? 7 : 1;
  const first = kind === 'week' ? mondayOf(fromDate) : fromDate;
  const last = kind === 'week' ? mondayOf(toDate) : toDate;

  const keys: string[] = [];
  for (let key = first; key <= last; key = addDays(key, step)) keys.push(key);
  const starts = [fromDate, ...keys.slice(1), addDays(last, step)].map((key) =>
    localDayStart(key, timezone),
  );
  return { keys, starts };
}
