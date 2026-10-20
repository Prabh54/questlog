import { startOfDay, endOfDay, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export interface DayBoundaries {
  start: Date;
  end: Date;
}

/**
 * Returns the UTC timestamps for the start and end of "today" in the given
 * IANA timezone (e.g. "America/New_York"). Defaults to UTC when omitted.
 */
export function todayBoundaries(timezone = 'UTC', now = new Date()): DayBoundaries {
  const zonedNow = toZonedTime(now, timezone);
  return {
    start: fromZonedTime(startOfDay(zonedNow), timezone),
    end: fromZonedTime(endOfDay(zonedNow), timezone),
  };
}

/**
 * Returns true when the given UTC date falls within "today" in the supplied
 * timezone.
 */
export function isToday(date: Date, timezone = 'UTC'): boolean {
  const { start, end } = todayBoundaries(timezone);
  return date >= start && date <= end;
}

/**
 * Converts a UTC Date to its YYYY-MM-DD representation in the given timezone,
 * useful for keying daily records.
 */
export function toLocalDateString(date: Date, timezone = 'UTC'): string {
  return toZonedTime(date, timezone).toISOString().slice(0, 10);
}

/** UTC boundaries of the ISO week containing `now`, in the given timezone. */
export function thisWeekBoundaries(timezone = 'UTC', now = new Date()): DayBoundaries {
  const zoned = toZonedTime(now, timezone);
  return {
    start: fromZonedTime(startOfISOWeek(zoned), timezone),
    end: fromZonedTime(endOfISOWeek(zoned), timezone),
  };
}

/** UTC boundaries of the calendar month containing `now`, in the given timezone. */
export function thisMonthBoundaries(timezone = 'UTC', now = new Date()): DayBoundaries {
  const zoned = toZonedTime(now, timezone);
  return {
    start: fromZonedTime(startOfMonth(zoned), timezone),
    end: fromZonedTime(endOfMonth(zoned), timezone),
  };
}

export type BucketFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** UTC boundaries of the completion bucket (day / ISO week / month) containing `now`. */
export function bucketBoundaries(
  frequency: BucketFrequency,
  timezone = 'UTC',
  now = new Date(),
): DayBoundaries {
  switch (frequency) {
    case 'DAILY':
      return todayBoundaries(timezone, now);
    case 'WEEKLY':
      return thisWeekBoundaries(timezone, now);
    case 'MONTHLY':
      return thisMonthBoundaries(timezone, now);
    case 'ONCE':
    default:
      return { start: new Date(0), end: new Date(8640000000000000) };
  }
}

/**
 * Stable key for the completion bucket containing `at` — the local date the
 * bucket starts on (e.g. "2026-10-19" for that ISO week), or "ONCE". Stored on
 * quest_entries.period_key, which is unique per quest. Must stay in sync with
 * the SQL backfill in the 20261020000000_entry_period_key migration.
 */
export function periodKey(
  frequency: BucketFrequency,
  timezone = 'UTC',
  at = new Date(),
): string {
  if (frequency === 'ONCE') return 'ONCE';
  const { start } = bucketBoundaries(frequency, timezone, at);
  return formatInTimeZone(start, timezone, 'yyyy-MM-dd');
}
