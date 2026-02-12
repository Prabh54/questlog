/**
 * Demo seed — populates the development database with realistic demo data
 * attached to the EXISTING user with email harpreet@gmail.com.
 *
 * Run: npm run seed   (ts-node prisma/seed.ts)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const TARGET_EMAIL = 'harpreet@gmail.com';

// ── Deterministic pseudo-random (no external deps) ────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rng = seededRng(42);

function dayStart(daysBack: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

// Random completion time between 7:00 and 22:00 on the given day
function randomTimeOnDay(daysBack: number): Date {
  const d = dayStart(daysBack);
  const hour = 7 + Math.floor(rng() * 15); // 7..21
  const minute = Math.floor(rng() * 60);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

// Pick `count` distinct integers in [0, max)
function pickDistinct(count: number, max: number): Set<number> {
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rng() * max));
  }
  return set;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🌱  Seeding demo data for ${TARGET_EMAIL}…`);

  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    throw new Error(
      `User with email ${TARGET_EMAIL} not found. Create the account first, then re-run.`,
    );
  }
  console.log(`  ✓ Found user: ${user.email} (id=${user.id})`);

  // ── Category definitions ───────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Fitness', color: '#84cc16' },
    { name: 'Study', color: '#6366f1' },
    { name: 'Health', color: '#06b6d4' },
    { name: 'Personal', color: '#f59e0b' },
  ];

  // ── Quest definitions with per-quest entry-generation strategies ───────
  type QuestDef = {
    title: string;
    categoryName: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'LEGENDARY';
    frequency: 'DAILY' | 'WEEKLY';
    xpReward: number;
    completedDays: (totalDays: number) => number[]; // returns daysBack values
  };

  const HISTORY_DAYS = 90;

  const questDefs: QuestDef[] = [
    {
      title: 'Gym — strength session',
      categoryName: 'Fitness',
      difficulty: 'MEDIUM',
      frequency: 'DAILY',
      xpReward: 25,
      // ~75% overall, current 14-day streak (last 14 days all complete)
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 14; d++) days.push(d);
        for (let d = 14; d < n; d++) {
          if (rng() < 0.73) days.push(d);
        }
        return days;
      },
    },
    {
      title: 'Read 20 pages',
      categoryName: 'Personal',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 15,
      // Every day for last 28 days; earlier history ~60%
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 28; d++) days.push(d);
        for (let d = 28; d < n; d++) {
          if (rng() < 0.6) days.push(d);
        }
        return days;
      },
    },
    {
      title: 'Deep work block — 2 hours',
      categoryName: 'Study',
      difficulty: 'HARD',
      frequency: 'DAILY',
      xpReward: 40,
      // Sporadic ~50% throughout
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < n; d++) {
          if (rng() < 0.5) days.push(d);
        }
        return days;
      },
    },
    {
      title: 'Sleep before midnight',
      categoryName: 'Health',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 10,
      // Improving: oldest 60 days ~40%, newest 30 days ~80%
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 30; d++) {
          if (rng() < 0.8) days.push(d);
        }
        for (let d = 30; d < n; d++) {
          if (rng() < 0.4) days.push(d);
        }
        return days;
      },
    },
    {
      title: 'Drink 3L water',
      categoryName: 'Health',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 10,
      // Near-perfect ~95%
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < n; d++) {
          if (rng() < 0.95) days.push(d);
        }
        return days;
      },
    },
    {
      title: 'Study CPSC 213',
      categoryName: 'Study',
      difficulty: 'MEDIUM',
      frequency: 'DAILY',
      xpReward: 25,
      // Abandoned: nothing for last 9 days, perfect 60 days before that
      completedDays: (n) => {
        const days: number[] = [];
        // days 9..68 (60 days of perfect streak, oldest portion)
        for (let d = 9; d < 9 + 60 && d < n; d++) days.push(d);
        return days;
      },
    },
    {
      title: 'Call parents',
      categoryName: 'Personal',
      difficulty: 'EASY',
      frequency: 'WEEKLY',
      xpReward: 20,
      // 10 of last 12 weeks — skip 2
      completedDays: () => {
        const skip = pickDistinct(2, 12);
        const days: number[] = [];
        for (let w = 0; w < 12; w++) {
          if (!skip.has(w)) {
            // pick a random day within that week
            const offset = Math.floor(rng() * 7);
            days.push(w * 7 + offset);
          }
        }
        return days;
      },
    },
    {
      title: 'Run 5K',
      categoryName: 'Fitness',
      difficulty: 'HARD',
      frequency: 'WEEKLY',
      xpReward: 50,
      // 6 of last 12 weeks — skip 6
      completedDays: () => {
        const skip = pickDistinct(6, 12);
        const days: number[] = [];
        for (let w = 0; w < 12; w++) {
          if (!skip.has(w)) {
            const offset = Math.floor(rng() * 7);
            days.push(w * 7 + offset);
          }
        }
        return days;
      },
    },
  ];

  // ── Run all writes in a single transaction ─────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Clean prior demo data owned by this user (cascade deletes entries)
    await tx.questEntry.deleteMany({ where: { userId: user.id } });
    await tx.quest.deleteMany({ where: { userId: user.id } });
    await tx.category.deleteMany({ where: { userId: user.id } });

    // Create categories
    const categories = await Promise.all(
      categoryDefs.map((c) =>
        tx.category.create({ data: { ...c, userId: user.id } }),
      ),
    );
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    console.log(`  ✓ ${categories.length} categories created`);

    // Create quests + collect entries
    const entries: Prisma.QuestEntryCreateManyInput[] = [];
    let totalXp = 0;

    for (const def of questDefs) {
      const category = categoryByName.get(def.categoryName);
      if (!category) throw new Error(`Missing category: ${def.categoryName}`);

      const quest = await tx.quest.create({
        data: {
          title: def.title,
          difficulty: def.difficulty,
          frequency: def.frequency,
          xpReward: def.xpReward,
          categoryId: category.id,
          userId: user.id,
          status: 'ACTIVE',
        },
      });

      const daysBackList = def.completedDays(HISTORY_DAYS);
      for (const daysBack of daysBackList) {
        if (daysBack < 0 || daysBack >= HISTORY_DAYS) continue;
        entries.push({
          questId: quest.id,
          userId: user.id,
          xpEarned: def.xpReward,
          completedAt: randomTimeOnDay(daysBack),
        });
        totalXp += def.xpReward;
      }
    }
    console.log(`  ✓ ${questDefs.length} quests created`);

    // Bulk insert entries
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      await tx.questEntry.createMany({ data: entries.slice(i, i + CHUNK) });
    }
    console.log(`  ✓ ${entries.length} quest entries created`);

    // Sync user XP/level to match seeded entries
    const level = Math.floor(1 + Math.sqrt(totalXp / 50));
    await tx.user.update({
      where: { id: user.id },
      data: { xp: totalXp, level },
    });
    console.log(`  ✓ User XP synced: ${totalXp} XP / Level ${level}`);
  });

  console.log('\n🎉  Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
