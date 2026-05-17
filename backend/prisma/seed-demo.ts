/**
 * Demo-account seed — creates demo@questlog.app / questdemo123 on any DB
 * and populates it with 90 days of realistic quest data.
 *
 * Local:      DATABASE_URL=<local_url> npx ts-node prisma/seed-demo.ts
 * Production: flyctl proxy 15432:5432 -a <pg-app>  (in another terminal)
 *             DATABASE_URL=postgresql://... npx ts-node prisma/seed-demo.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL    = 'demo@questlog.app';
const DEMO_PASSWORD = 'questdemo123';
const DEMO_USERNAME = 'DemoAdventurer';
const BCRYPT_ROUNDS = 12;

// ── Deterministic pseudo-random ──────────────────────────────────────────────
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

function randomTimeOnDay(daysBack: number): Date {
  const d = dayStart(daysBack);
  const hour   = 7 + Math.floor(rng() * 15);
  const minute = Math.floor(rng() * 60);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function pickDistinct(count: number, max: number): Set<number> {
  const set = new Set<number>();
  while (set.size < count) set.add(Math.floor(rng() * max));
  return set;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🌱  Seeding demo account: ${DEMO_EMAIL}`);

  // Upsert user — create or reset password
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where:  { email: DEMO_EMAIL },
    update: { password: passwordHash, username: DEMO_USERNAME },
    create: { email: DEMO_EMAIL, username: DEMO_USERNAME, password: passwordHash },
  });
  console.log(`  ✓ User ready: ${user.email} (id=${user.id})`);

  // ── Category definitions ──────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Fitness',  color: '#84cc16' },
    { name: 'Study',    color: '#6366f1' },
    { name: 'Health',   color: '#06b6d4' },
    { name: 'Personal', color: '#f59e0b' },
  ];

  // ── Quest patterns ────────────────────────────────────────────────────────
  type QuestDef = {
    title: string;
    categoryName: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'LEGENDARY';
    frequency: 'DAILY' | 'WEEKLY';
    xpReward: number;
    completedDays: (totalDays: number) => number[];
  };

  const HISTORY_DAYS = 90;

  const questDefs: QuestDef[] = [
    {
      title: 'Gym — strength session',
      categoryName: 'Fitness',
      difficulty: 'MEDIUM',
      frequency: 'DAILY',
      xpReward: 25,
      // ~75% overall, current 14-day streak
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 14; d++) days.push(d);
        for (let d = 14; d < n; d++) { if (rng() < 0.73) days.push(d); }
        return days;
      },
    },
    {
      title: 'Read 20 pages',
      categoryName: 'Personal',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 15,
      // Every day last 28 days; ~60% before
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 28; d++) days.push(d);
        for (let d = 28; d < n; d++) { if (rng() < 0.6) days.push(d); }
        return days;
      },
    },
    {
      title: 'Deep work block — 2 hours',
      categoryName: 'Study',
      difficulty: 'HARD',
      frequency: 'DAILY',
      xpReward: 40,
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < n; d++) { if (rng() < 0.5) days.push(d); }
        return days;
      },
    },
    {
      title: 'Sleep before midnight',
      categoryName: 'Health',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 10,
      // Improving: ~40% old, ~80% recent
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < 30; d++) { if (rng() < 0.8) days.push(d); }
        for (let d = 30; d < n; d++) { if (rng() < 0.4) days.push(d); }
        return days;
      },
    },
    {
      title: 'Drink 3L water',
      categoryName: 'Health',
      difficulty: 'EASY',
      frequency: 'DAILY',
      xpReward: 10,
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 0; d < n; d++) { if (rng() < 0.95) days.push(d); }
        return days;
      },
    },
    {
      title: 'Study algorithms',
      categoryName: 'Study',
      difficulty: 'MEDIUM',
      frequency: 'DAILY',
      xpReward: 25,
      // 60-day streak then abandoned (shows heatmap gap)
      completedDays: (n) => {
        const days: number[] = [];
        for (let d = 9; d < 9 + 60 && d < n; d++) days.push(d);
        return days;
      },
    },
    {
      title: 'Call family',
      categoryName: 'Personal',
      difficulty: 'EASY',
      frequency: 'WEEKLY',
      xpReward: 20,
      // 10 of 12 weeks
      completedDays: () => {
        const skip = pickDistinct(2, 12);
        const days: number[] = [];
        for (let w = 0; w < 12; w++) {
          if (!skip.has(w)) days.push(w * 7 + Math.floor(rng() * 7));
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
      // 6 of 12 weeks
      completedDays: () => {
        const skip = pickDistinct(6, 12);
        const days: number[] = [];
        for (let w = 0; w < 12; w++) {
          if (!skip.has(w)) days.push(w * 7 + Math.floor(rng() * 7));
        }
        return days;
      },
    },
  ];

  await prisma.$transaction(async (tx) => {
    // Wipe previous demo data
    await tx.questEntry.deleteMany({ where: { userId: user.id } });
    await tx.quest.deleteMany({ where: { userId: user.id } });
    await tx.category.deleteMany({ where: { userId: user.id } });

    // Categories
    const categories = await Promise.all(
      categoryDefs.map((c) => tx.category.create({ data: { ...c, userId: user.id } })),
    );
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    console.log(`  ✓ ${categories.length} categories`);

    // Quests + entries
    const entries: Prisma.QuestEntryCreateManyInput[] = [];
    let totalXp = 0;

    for (const def of questDefs) {
      const category = categoryByName.get(def.categoryName)!;
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
      for (const daysBack of def.completedDays(HISTORY_DAYS)) {
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
    console.log(`  ✓ ${questDefs.length} quests`);

    // Bulk insert entries in 500-row chunks
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      await tx.questEntry.createMany({ data: entries.slice(i, i + CHUNK) });
    }
    console.log(`  ✓ ${entries.length} quest entries`);

    // Sync XP / level
    const level = Math.floor(1 + Math.sqrt(totalXp / 50));
    await tx.user.update({
      where: { id: user.id },
      data: { xp: totalXp, level },
    });
    console.log(`  ✓ XP synced: ${totalXp} XP → Level ${level}`);
  });

  console.log('\n🎉  Demo account ready!');
  console.log(`    email:    ${DEMO_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
