import { prisma } from '../db/prisma';
import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Helpers ───────────────────────────────────────────────────────────────

interface UserSession {
  token: string;
  user: { id: string; email: string; username: string };
}

async function registerAndLogin(overrides: {
  email?: string;
  display_name?: string;
  password?: string;
} = {}): Promise<UserSession> {
  const ts = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const payload = {
    email: overrides.email ?? `user${ts}@test.com`,
    display_name: overrides.display_name ?? `user${ts}`,
    password: overrides.password ?? 'Password123!',
  };
  const res = await agent.post('/auth/register').send(payload);
  return res.body as UserSession;
}

async function createQuest(
  token: string,
  overrides: {
    title?: string;
    frequency?: string;
    xp_reward?: number;
  } = {},
) {
  const res = await agent
    .post('/quests')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title ?? `Quest ${Date.now()}`,
      difficulty: 'EASY',
      frequency: overrides.frequency ?? 'DAILY',
      xp_reward: overrides.xp_reward ?? 10,
      is_active: true,
    });
  return res.body.quest as { id: string; xp_reward: number; frequency: string };
}

async function completeQuest(token: string, questId: string, note?: string) {
  return agent
    .post(`/quests/${questId}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send(note ? { note } : {});
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Entries integration', () => {
  let session: UserSession;

  beforeAll(async () => {
    await cleanDb();
    session = await registerAndLogin();
  });

  afterAll(async () => {
    await cleanDb();
  });

  // ── Complete a quest ───────────────────────────────────────────────────

  describe('POST /quests/:id/complete', () => {
    it('creates a completion entry → 201 with xpEarned matching quest.xpReward', async () => {
      const quest = await createQuest(session.token, { xp_reward: 15 });

      const res = await completeQuest(session.token, quest.id);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('entry');
      expect(res.body.entry.xpEarned).toBe(15);
      expect(res.body.entry.questId).toBe(quest.id);
      expect(res.body.entry.userId).toBe(session.user.id);
    });

    it('completing same DAILY quest again today → 409 ALREADY_COMPLETED_TODAY', async () => {
      const quest = await createQuest(session.token, { frequency: 'DAILY' });

      const first = await completeQuest(session.token, quest.id);
      expect(first.status).toBe(201);

      const second = await completeQuest(session.token, quest.id);
      expect(second.status).toBe(409);
      expect(second.body.error).toBe('ALREADY_COMPLETED_TODAY');
    });

    it('ONCE quest: first completion → 201 and status becomes COMPLETED; second → 409', async () => {
      const quest = await createQuest(session.token, { frequency: 'ONCE' });

      const first = await completeQuest(session.token, quest.id);
      expect(first.status).toBe(201);

      // Verify quest status flipped to COMPLETED
      const questRes = await agent
        .get(`/quests/${quest.id}`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(questRes.body.quest.status).toBe('COMPLETED');

      const second = await completeQuest(session.token, quest.id);
      expect(second.status).toBe(409);
    });
  });

  // ── Cursor pagination ──────────────────────────────────────────────────

  describe('GET /entries cursor pagination', () => {
    it('paginates 30 entries across 3 pages of limit=10 with no duplicates', async () => {
      // Clean slate for this sub-test to have predictable counts
      await cleanDb();
      const paginationSession = await registerAndLogin();

      // Create a single quest to complete 30 times (ONCE per artificial timestamp)
      // Since DAILY quests enforce one-per-day, we create 30 separate ONCE quests
      // and complete each — spread across different insertion times.
      const questIds: string[] = [];
      for (let i = 0; i < 30; i++) {
        const q = await createQuest(paginationSession.token, {
          title: `Paginated Quest ${i}`,
          frequency: 'ONCE',
          xp_reward: 5,
        });
        questIds.push(q.id);
      }

      // Complete all 30 quests; use direct DB writes with varying completedAt
      // so that pagination ordering is well-defined across "days".
      const userId = paginationSession.user.id;

      // Remove the entries created by the /complete calls (none yet) —
      // instead we directly seed the entries with spread timestamps.
      const baseTime = new Date('2025-01-01T12:00:00Z').getTime();

      // Complete each ONCE quest via the API first (sets status to COMPLETED),
      // then adjust the completedAt timestamp via direct DB update for pagination spread.
      for (let i = 0; i < 30; i++) {
        const completeRes = await agent
          .post(`/quests/${questIds[i]}/complete`)
          .set('Authorization', `Bearer ${paginationSession.token}`)
          .send({});
        expect(completeRes.status).toBe(201);
      }

      // Spread the completedAt timestamps across 30 different days
      await prisma.questEntry.updateMany({
        where: { userId },
        data: {}, // We need per-row updates; do them individually
      });

      const allEntries = await prisma.questEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      for (let i = 0; i < allEntries.length; i++) {
        await prisma.questEntry.update({
          where: { id: allEntries[i].id },
          data: { completedAt: new Date(baseTime + i * 24 * 60 * 60 * 1000) },
        });
      }

      // Now paginate: 3 pages of limit=10
      const collectedIds: string[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 3; page++) {
        const url = cursor
          ? `/entries?limit=10&cursor=${encodeURIComponent(cursor)}`
          : '/entries?limit=10';

        const res = await agent
          .get(url)
          .set('Authorization', `Bearer ${paginationSession.token}`);

        expect(res.status).toBe(200);
        expect(res.body.entries).toHaveLength(10);

        for (const entry of res.body.entries) {
          collectedIds.push(entry.id);
        }

        if (page < 2) {
          expect(res.body.nextCursor).not.toBeNull();
          cursor = res.body.nextCursor as string;
        } else {
          // Last page
          expect(res.body.nextCursor).toBeNull();
        }
      }

      // Total entries collected = 30
      expect(collectedIds).toHaveLength(30);

      // No duplicate IDs
      const uniqueIds = new Set(collectedIds);
      expect(uniqueIds.size).toBe(30);
    });
  });
});
