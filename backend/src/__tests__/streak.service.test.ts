import { calculateStreak } from '../services/streak.service';

const UTC = 'UTC';

// Build entries from a list of ISO date-time strings
const e = (...iso: string[]) => iso.map((s) => ({ completedAt: new Date(s) }));

describe('calculateStreak — DAILY', () => {
  const now = new Date('2026-05-15T12:00:00Z'); // Friday

  it('returns zeros for empty input', () => {
    expect(calculateStreak([], 'DAILY', UTC, now)).toEqual({
      current: 0,
      longest: 0,
      totalCompletions: 0,
    });
  });

  it('counts a full 5-day streak ending today', () => {
    const entries = e(
      '2026-05-11T10:00:00Z',
      '2026-05-12T10:00:00Z',
      '2026-05-13T10:00:00Z',
      '2026-05-14T10:00:00Z',
      '2026-05-15T10:00:00Z',
    );
    expect(calculateStreak(entries, 'DAILY', UTC, now)).toEqual({
      current: 5,
      longest: 5,
      totalCompletions: 5,
    });
  });

  it('applies grace period when today missing but yesterday present', () => {
    const entries = e(
      '2026-05-12T10:00:00Z',
      '2026-05-13T10:00:00Z',
      '2026-05-14T10:00:00Z', // yesterday relative to now
    );
    const r = calculateStreak(entries, 'DAILY', UTC, now);
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });

  it('breaks at gap — current is 0 when neither today nor yesterday', () => {
    const entries = e(
      '2026-05-10T10:00:00Z',
      '2026-05-11T10:00:00Z',
      '2026-05-12T10:00:00Z',
    );
    const r = calculateStreak(entries, 'DAILY', UTC, now);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(3);
  });

  it('deduplicates multiple entries on the same day', () => {
    const entries = e(
      '2026-05-15T08:00:00Z',
      '2026-05-15T12:00:00Z',
      '2026-05-15T22:00:00Z',
    );
    expect(calculateStreak(entries, 'DAILY', UTC, now)).toEqual({
      current: 1,
      longest: 1,
      totalCompletions: 1,
    });
  });

  it('longest spans a gap', () => {
    // 5-run, gap, 3-run ending today → longest 5, current 3
    const entries = e(
      '2026-05-01T10:00:00Z',
      '2026-05-02T10:00:00Z',
      '2026-05-03T10:00:00Z',
      '2026-05-04T10:00:00Z',
      '2026-05-05T10:00:00Z',
      // gap
      '2026-05-13T10:00:00Z',
      '2026-05-14T10:00:00Z',
      '2026-05-15T10:00:00Z',
    );
    const r = calculateStreak(entries, 'DAILY', UTC, now);
    expect(r.longest).toBe(5);
    expect(r.current).toBe(3);
    expect(r.totalCompletions).toBe(8);
  });

  it('handles timezone-boundary case (UTC entry at 23:30 is next day in Tokyo)', () => {
    // 2026-05-14T23:30:00Z is 2026-05-15 08:30 in Tokyo (UTC+9)
    // So in Asia/Tokyo this counts as today (relative to a Tokyo "now" of 2026-05-15)
    const tokyoNow = new Date('2026-05-15T03:00:00Z'); // = 12:00 in Tokyo
    const entries = e('2026-05-14T23:30:00Z');
    const r = calculateStreak(entries, 'DAILY', 'Asia/Tokyo', tokyoNow);
    expect(r.current).toBe(1);
    expect(r.totalCompletions).toBe(1);
  });
});

describe('calculateStreak — WEEKLY', () => {
  // 2026-05-15 is Friday of ISO week 2026-W20
  const now = new Date('2026-05-15T12:00:00Z');

  it('counts three consecutive weeks', () => {
    const entries = e(
      '2026-05-01T10:00:00Z', // W18
      '2026-05-08T10:00:00Z', // W19
      '2026-05-15T10:00:00Z', // W20 (this week)
    );
    const r = calculateStreak(entries, 'WEEKLY', UTC, now);
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.totalCompletions).toBe(3);
  });

  it('applies grace period when last week present but not this week', () => {
    const entries = e('2026-05-04T10:00:00Z', '2026-05-08T10:00:00Z'); // both W19
    // both fall in W19 ⇒ 1 bucket, that's "last week" → current = 1 via grace
    const r = calculateStreak(entries, 'WEEKLY', UTC, now);
    expect(r.current).toBe(1);
  });
});

describe('calculateStreak — ONCE / MONTHLY', () => {
  const now = new Date('2026-05-15T12:00:00Z');

  it('ONCE returns 1/1/1 if any completion exists', () => {
    expect(calculateStreak(e('2026-01-01T00:00:00Z'), 'ONCE', UTC, now)).toEqual({
      current: 1,
      longest: 1,
      totalCompletions: 1,
    });
  });

  it('MONTHLY returns totalCompletions but no streak metric', () => {
    const r = calculateStreak(
      e('2026-05-01T00:00:00Z', '2026-05-15T00:00:00Z'),
      'MONTHLY',
      UTC,
      now,
    );
    expect(r.totalCompletions).toBe(2);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
  });
});
