import { startOfDay, endOfDay, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

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
