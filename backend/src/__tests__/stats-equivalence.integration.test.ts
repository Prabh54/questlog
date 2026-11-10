/**
 * Differential tests: the SQL aggregates in stats.queries.ts must give exactly
 * what the original TypeScript computed from raw rows. The reference side is
 * calculateStreak() (unchanged, unit-tested in streak.service.test.ts) plus
 * the JS bucketing analytics.service used before the move to SQL.
 *
 * Histories are random (seeded, so failures reproduce) across timezones that
 * stress local-day boundaries: west of UTC, half-hour offsets with DST, and
 * both extremes of the date line.
 */
import { formatInTimeZone } from 'date-fns-tz';
import type { QuestFrequency } from '@prisma/client';
import { prisma } from '../db/prisma';
import { calculateStreak } from '../services/streak.service';
import {
  completedDays,
  streakStats,
  totalsByBucket,
  totalsByCategory,
} from '../services/stats.queries';
import { periodKey, todayBoundaries } from '../utils/dates';
import { localBuckets, localDate } from '../utils/local-buckets';
import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Seeded randomness ─────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Reference (the pre-SQL JavaScript) ────────────────────────────────────
function refBucketKey(date: Date, bucket: 'day' | 'week', tz: string): string {
  if (bucket === 'week') {
    const [y, m, d] = formatInTimeZone(date, tz, 'yyyy-MM-dd').split('-').map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d));
    const jsDay = anchor.getUTCDay();
    anchor.setUTCDate(anchor.getUTCDate() - (jsDay === 0 ? 6 : jsDay - 1));
    return anchor.toISOString().slice(0, 10);
  }
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const TIMEZONES = [
  'UTC',
  'America/Vancouver',
  'America/St_Johns', // UTC−3:30 / −2:30 with DST
  'Asia/Kathmandu', // UTC+5:45
  'Pacific/Kiritimati', // UTC+14
  'Pacific/Pago_Pago', // UTC−11
  'America/Santiago', // DST switches at midnight: some local days start at 01:00
];

const QUEST_PLAN: { frequency: QuestFrequency; density: number }[] = [
  { frequency: 'DAILY', density: 0.9 },
  { frequency: 'DAILY', density: 0.5 },
  { frequency: 'DAILY', density: 0.15 },
  { frequency: 'WEEKLY', density: 0.8 },
  { frequency: 'MONTHLY', density: 0.7 },
  { frequency: 'ONCE', density: 1 },
];

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 400;

interface Fixture {
  userId: string;
  timezone: string;
  quests: { id: string; frequency: QuestFrequency; categoryId: string | null }[];
  entries: { questId: string; completedAt: Date; xpEarned: number }[];
}

async function buildFixture(timezone: string, seed: number, now: Date): Promise<Fixture> {
  const rand = mulberry32(seed);
  const user = await prisma.user.create({
    data: {
      email: `eq${seed}@test.com`,
      username: `eq${seed}`,
      password: 'x',
      timezone,
    },
  });
  const categories = await Promise.all(
    ['A', 'B'].map((name) => prisma.category.create({ data: { name, userId: user.id } })),
  );

  const fixture: Fixture = { userId: user.id, timezone, quests: [], entries: [] };
  for (const [i, plan] of QUEST_PLAN.entries()) {
    const categoryId = i % 3 === 2 ? null : categories[i % 2].id; // some uncategorized
    const quest = await prisma.quest.create({
      data: {
        userId: user.id,
        title: `q${i}`,
        frequency: plan.frequency,
        xpReward: 5 + i * 5,
        categoryId,
      },
    });
    fixture.quests.push({ id: quest.id, frequency: plan.frequency, categoryId });

    // Any instant in the window: random times of day hit local-midnight edges.
    // Keep one completion per period, as the API's unique (quest, period) index does.
    const seen = new Set<string>();
    const attempts = plan.frequency === 'ONCE' ? 1 : HISTORY_DAYS;
    for (let n = 0; n < attempts; n++) {
      // Dense recent days so current streaks and the grace period are exercised
      const daysAgo = n < 10 ? n : rand() * HISTORY_DAYS;
      if (rand() > plan.density) continue;
      const completedAt = new Date(now.getTime() - daysAgo * DAY - rand() * DAY);
      const key = periodKey(plan.frequency, timezone, completedAt);
      if (seen.has(key)) continue;
      seen.add(key);
      fixture.entries.push({ questId: quest.id, completedAt, xpEarned: 5 + i * 5 });
    }
  }

  await prisma.questEntry.createMany({
    data: fixture.entries.map((e) => ({
      ...e,
      userId: user.id,
      periodKey: periodKey(
        fixture.quests.find((q) => q.id === e.questId)!.frequency,
        timezone,
        e.completedAt,
      ),
    })),
  });
  return fixture;
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('SQL aggregates match the original TypeScript', () => {
  const now = new Date();
  const fixtures: Fixture[] = [];

  beforeAll(async () => {
    await cleanDb();
    for (const [i, tz] of TIMEZONES.entries()) {
      fixtures.push(await buildFixture(tz, 1000 + i, now));
    }
  }, 60_000);

  afterAll(async () => {
    await cleanDb();
  });

  it('builds non-trivial histories', () => {
    const total = fixtures.reduce((n, f) => n + f.entries.length, 0);
    expect(total).toBeGreaterThan(TIMEZONES.length * 500);
  });

  // Now, then later the same day, the next days (grace period) and past it
  // (streak broken), so every branch of "current streak" is exercised.
  const instants = [0, 0.3, 0.7, 1, 1.5, 2, 3, 8].map((d) => new Date(now.getTime() + d * DAY));

  it.each(TIMEZONES)('streaks in %s, at 8 different "now"s', async (tz) => {
    const f = fixtures.find((x) => x.timezone === tz)!;
    for (const at of instants) {
      const sql = await streakStats(f.userId, tz, undefined, at);
      for (const q of f.quests) {
        const expected = calculateStreak(
          f.entries.filter((e) => e.questId === q.id),
          q.frequency,
          tz,
          at,
        );
        const actual = sql.get(q.id) ?? { current: 0, longest: 0, totalCompletions: 0 };
        expect({ quest: q.frequency, at: at.toISOString(), ...actual }).toEqual({
          quest: q.frequency,
          at: at.toISOString(),
          ...expected,
        });
      }
    }
  });

  it.each(TIMEZONES)('per-day and per-week totals in %s', async (tz) => {
    const f = fixtures.find((x) => x.timezone === tz)!;
    const from = new Date(now.getTime() - 200 * DAY);
    // The old code counted from the start of `from`'s local day
    const { start: fromUtc } = todayBoundaries(tz, from);
    for (const bucket of ['day', 'week'] as const) {
      const expected = new Map<string, { count: number; xp: number }>();
      for (const e of f.entries.filter((x) => x.completedAt >= fromUtc)) {
        const key = refBucketKey(e.completedAt, bucket, tz);
        const cur = expected.get(key) ?? { count: 0, xp: 0 };
        expected.set(key, { count: cur.count + 1, xp: cur.xp + e.xpEarned });
      }
      const buckets = localBuckets(bucket, tz, localDate(from, tz), localDate(now, tz));
      const actual = await totalsByBucket(f.userId, buckets);
      expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected));
    }
  });

  it.each(TIMEZONES)('category totals in %s', async (tz) => {
    const f = fixtures.find((x) => x.timezone === tz)!;
    const expected = new Map<string | null, { completions: number; xp: number }>();
    for (const e of f.entries) {
      const cat = f.quests.find((q) => q.id === e.questId)!.categoryId;
      const cur = expected.get(cat) ?? { completions: 0, xp: 0 };
      expected.set(cat, { completions: cur.completions + 1, xp: cur.xp + e.xpEarned });
    }
    const actual = await totalsByCategory(f.userId);
    expect(
      new Map(actual.map((r) => [r.category_id, { completions: r.completions, xp: r.xp }])),
    ).toEqual(expected);
  });

  it.each(TIMEZONES)('recent completed days in %s', async (tz) => {
    const f = fixtures.find((x) => x.timezone === tz)!;
    const from = new Date(now.getTime() - 15 * DAY);
    const days = localBuckets('day', tz, localDate(from, tz), localDate(now, tz));
    const actual = await completedDays(f.userId, f.quests.map((q) => q.id), days);
    for (const q of f.quests) {
      const expected = new Set(
        f.entries
          .filter((e) => e.questId === q.id && e.completedAt >= days.starts[0])
          .map((e) => formatInTimeZone(e.completedAt, tz, 'yyyy-MM-dd')),
      );
      expect(actual.get(q.id) ?? new Set()).toEqual(expected);
    }
  });
});

describe('Quest list stats are not capped', () => {
  beforeAll(async () => {
    await cleanDb();
  });
  afterAll(async () => {
    await cleanDb();
  });

  it('reports the same streak and total in the list as on the detail page', async () => {
    const reg = await agent.post('/auth/register').send({
      email: 'cap@test.com',
      display_name: 'capped',
      password: 'Password123',
    });
    const token = reg.body.token as string;
    const created = await agent
      .post('/quests')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Meditate', frequency: 'DAILY' });
    const quest = created.body.quest as { id: string };

    // 80 consecutive days ending today (the old list loaded only the latest 60)
    const now = Date.now();
    await prisma.questEntry.createMany({
      data: Array.from({ length: 80 }, (_, i) => {
        const completedAt = new Date(now - i * DAY);
        return {
          questId: quest.id,
          userId: reg.body.user.id,
          xpEarned: 10,
          completedAt,
          periodKey: periodKey('DAILY', 'UTC', completedAt),
        };
      }),
    });

    const list = await agent.get('/quests').set('Authorization', `Bearer ${token}`);
    const detail = await agent.get(`/quests/${quest.id}`).set('Authorization', `Bearer ${token}`);
    const fromList = list.body.quests.find((q: { id: string }) => q.id === quest.id);

    expect(fromList.total_completions).toBe(80);
    expect(fromList.streak).toBe(80);
    expect(fromList.longest_streak).toBe(80);
    expect(fromList.strip.every((d: { completed: boolean }) => d.completed)).toBe(true);
    expect(detail.body.quest).toMatchObject({
      total_completions: 80,
      streak: 80,
      longest_streak: 80,
    });
  });
});
