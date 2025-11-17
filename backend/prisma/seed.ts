/**
 * Demo seed — creates one realistic user with categories, quests, and ~1000
 * completion entries spread across the past year.
 *
 * Run: npm run db:seed   (ts-node prisma/seed.ts)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Deterministic pseudo-random (no external deps) ────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seededRng(42);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Seeding demo data…');

  // Wipe existing demo user if re-running
  await prisma.user.deleteMany({ where: { email: 'demo@questlog.app' } });

  // ── User ───────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('Demo1234!', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@questlog.app',
      username: 'DemoHero',
      password,
      timezone: 'America/New_York',
    },
  });
  console.log(`  ✓ User created: ${user.email}`);

  // ── Categories ─────────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Health', color: '#22c55e', description: 'Physical and mental wellbeing' },
    { name: 'Learning', color: '#6366f1', description: 'Continuous education and growth' },
    { name: 'Work', color: '#f59e0b', description: 'Career and productivity' },
    { name: 'Creativity', color: '#ec4899', description: 'Art, writing, and side projects' },
    { name: 'Mindfulness', color: '#14b8a6', description: 'Meditation and self-reflection' },
  ];

  const categories = await Promise.all(
    categoryDefs.map((c) =>
      prisma.category.create({ data: { ...c, userId: user.id } }),
    ),
  );
  const [health, learning, work, creativity, mindfulness] = categories;
  console.log(`  ✓ ${categories.length} categories created`);

  // ── Quests ─────────────────────────────────────────────────────────────
  const questDefs = [
    // DAILY quests — the bulk of entries
    {
      title: 'Morning Run',
      description: 'At least 20 minutes of cardio to start the day.',
      difficulty: 'MEDIUM' as const,
      frequency: 'DAILY' as const,
      xpReward: 15,
      categoryId: health.id,
      completionRate: 0.88,
    },
    {
      title: 'Code for 1 Hour',
      description: 'Deliberate practice: ship something or solve a problem.',
      difficulty: 'HARD' as const,
      frequency: 'DAILY' as const,
      xpReward: 25,
      categoryId: learning.id,
      completionRate: 0.82,
    },
    {
      title: 'Read 20 Pages',
      description: 'Non-fiction or technical reading — no doomscrolling.',
      difficulty: 'EASY' as const,
      frequency: 'DAILY' as const,
      xpReward: 10,
      categoryId: learning.id,
      completionRate: 0.91,
    },
    {
      title: 'Evening Meditation',
      description: '10-minute guided or silent session before bed.',
      difficulty: 'EASY' as const,
      frequency: 'DAILY' as const,
      xpReward: 10,
      categoryId: mindfulness.id,
      completionRate: 0.79,
    },
    // WEEKLY quests
    {
      title: 'Deep Work Session',
      description: '3-hour distraction-free block on the hardest problem of the week.',
      difficulty: 'LEGENDARY' as const,
      frequency: 'WEEKLY' as const,
      xpReward: 50,
      categoryId: work.id,
      completionRate: 0.80,
    },
    {
      title: 'Creative Side Project',
      description: 'Make progress on a personal creative project.',
      difficulty: 'MEDIUM' as const,
      frequency: 'WEEKLY' as const,
      xpReward: 30,
      categoryId: creativity.id,
      completionRate: 0.72,
    },
    // MONTHLY quest
    {
      title: 'Monthly Retrospective',
      description: 'Review goals, habits, and direction for the coming month.',
      difficulty: 'MEDIUM' as const,
      frequency: 'MONTHLY' as const,
      xpReward: 100,
      categoryId: mindfulness.id,
      completionRate: 0.92,
    },
    // ONCE quest (already done)
    {
      title: 'Set Up GitHub Profile README',
      description: 'Create a polished developer profile page.',
      difficulty: 'EASY' as const,
      frequency: 'ONCE' as const,
      xpReward: 20,
      categoryId: work.id,
      completionRate: 1.0,
      status: 'COMPLETED' as const,
    },
  ];

  const quests = await Promise.all(
    questDefs.map((q) =>
      prisma.quest.create({
        data: {
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          frequency: q.frequency,
          xpReward: q.xpReward,
          categoryId: q.categoryId,
          userId: user.id,
          status: q.status ?? 'ACTIVE',
          completedAt: q.status === 'COMPLETED' ? daysAgo(180) : null,
        },
      }),
    ),
  );
  console.log(`  ✓ ${quests.length} quests created`);

  // ── Entries — ~1000 completions over 365 days ───────────────────────────
  const HISTORY_DAYS = 365;
  const entries: {
    questId: string;
    userId: string;
    xpEarned: number;
    note: string | null;
    completedAt: Date;
  }[] = [];

  const noteSamples = [
    'Felt great today!',
    'Tough but done.',
    'Short session but still counts.',
    null,
    null,
    null, // most entries have no note
    'Personal best this week.',
    'Needed some motivation.',
  ];

  function randomNote(): string | null {
    return noteSamples[Math.floor(rng() * noteSamples.length)];
  }

  // DAILY quests — iterate every day for the past year
  const dailyQuests = quests.filter((q) => questDefs.find((d) => d.title === q.title)?.frequency === 'DAILY');
  for (let day = HISTORY_DAYS; day >= 0; day--) {
    const date = daysAgo(day);
    for (const quest of dailyQuests) {
      const def = questDefs.find((d) => d.title === quest.title)!;
      if (rng() < def.completionRate) {
        const minuteOffset = Math.floor(rng() * 720); // within 12h window
        entries.push({
          questId: quest.id,
          userId: user.id,
          xpEarned: quest.xpReward,
          note: randomNote(),
          completedAt: addMinutes(date, minuteOffset),
        });
      }
    }
  }

  // WEEKLY quests — one opportunity per week
  const weeklyQuests = quests.filter((q) => questDefs.find((d) => d.title === q.title)?.frequency === 'WEEKLY');
  for (let week = Math.floor(HISTORY_DAYS / 7); week >= 0; week--) {
    const date = daysAgo(week * 7);
    for (const quest of weeklyQuests) {
      const def = questDefs.find((d) => d.title === quest.title)!;
      if (rng() < def.completionRate) {
        const hourOffset = Math.floor(rng() * 48 * 60); // within 2-day window
        entries.push({
          questId: quest.id,
          userId: user.id,
          xpEarned: quest.xpReward,
          note: randomNote(),
          completedAt: addMinutes(date, hourOffset),
        });
      }
    }
  }

  // MONTHLY quests — one opportunity per month
  const monthlyQuests = quests.filter((q) => questDefs.find((d) => d.title === q.title)?.frequency === 'MONTHLY');
  for (let month = 12; month >= 0; month--) {
    const date = daysAgo(month * 30);
    for (const quest of monthlyQuests) {
      const def = questDefs.find((d) => d.title === quest.title)!;
      if (rng() < def.completionRate) {
        entries.push({
          questId: quest.id,
          userId: user.id,
          xpEarned: quest.xpReward,
          note: randomNote(),
          completedAt: addMinutes(date, Math.floor(rng() * 1440)),
        });
      }
    }
  }

  // ONCE quest — single completion 180 days ago
  const onceQuest = quests.find((q) => questDefs.find((d) => d.title === q.title)?.frequency === 'ONCE')!;
  if (onceQuest) {
    entries.push({
      questId: onceQuest.id,
      userId: user.id,
      xpEarned: onceQuest.xpReward,
      note: 'Finally got around to it!',
      completedAt: daysAgo(180),
    });
  }

  // Bulk-insert entries in chunks to avoid query limits
  const CHUNK = 200;
  for (let i = 0; i < entries.length; i += CHUNK) {
    await prisma.questEntry.createMany({ data: entries.slice(i, i + CHUNK) });
  }
  console.log(`  ✓ ${entries.length} completion entries created`);

  // ── Update user XP to match entries ────────────────────────────────────
  const totalXp = entries.reduce((sum, e) => sum + e.xpEarned, 0);
  const level = Math.floor(1 + Math.sqrt(totalXp / 50));
  await prisma.user.update({
    where: { id: user.id },
    data: { xp: totalXp, level },
  });
  console.log(`  ✓ User XP updated: ${totalXp} XP / Level ${level}`);

  console.log('\n🎉  Seed complete!');
  console.log('   Email:    demo@questlog.app');
  console.log('   Password: Demo1234!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
