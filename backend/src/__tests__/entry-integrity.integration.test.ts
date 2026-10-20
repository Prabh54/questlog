import { prisma } from '../db/prisma';
import { periodKey } from '../utils/dates';
import { levelProgress } from '../services/xp.service';
import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Helpers ───────────────────────────────────────────────────────────────

interface UserSession {
  token: string;
  user: { id: string };
}

async function register(): Promise<UserSession> {
  const ts = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const res = await agent.post('/auth/register').send({
    email: `user${ts}@test.com`,
    display_name: `user${ts}`,
    password: 'Password123!',
  });
  return res.body as UserSession;
}

async function createQuest(token: string, frequency: string, xpReward: number) {
  const res = await agent
    .post('/quests')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Quest ${Date.now()}`,
      difficulty: 'EASY',
      frequency,
      xp_reward: xpReward,
      is_active: true,
    });
  return res.body.quest as { id: string };
}

function complete(token: string, questId: string) {
  return agent.post(`/quests/${questId}/complete`).set('Authorization', `Bearer ${token}`).send({});
}

function undo(token: string, entryId: string) {
  return agent.delete(`/entries/${entryId}`).set('Authorization', `Bearer ${token}`);
}

async function getMe(token: string) {
  const res = await agent.get('/auth/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.user as { xp: number; level: number; progress: number; xpToNext: number };
}

async function entryXpSum(userId: string) {
  const agg = await prisma.questEntry.aggregate({ where: { userId }, _sum: { xpEarned: true } });
  return agg._sum.xpEarned ?? 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Entry data integrity', () => {
  let session: UserSession;

  beforeAll(async () => {
    await cleanDb();
  });

  beforeEach(async () => {
    session = await register();
  });

  afterAll(async () => {
    await cleanDb();
  });

  describe('concurrent completes', () => {
    it.each(['DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'])(
      '%s: 5 parallel completes → exactly one 201, the rest 409',
      async (frequency) => {
        const quest = await createQuest(session.token, frequency, 10);

        const results = await Promise.all(
          Array.from({ length: 5 }, () => complete(session.token, quest.id)),
        );

        const statuses = results.map((r) => r.status).sort();
        expect(statuses).toEqual([201, 409, 409, 409, 409]);
        for (const r of results.filter((r) => r.status === 409)) {
          expect(r.body.error).toBe('ALREADY_COMPLETED_TODAY');
        }
        expect(await prisma.questEntry.count({ where: { questId: quest.id } })).toBe(1);
      },
    );

    it('stores the period key of the completion bucket', async () => {
      const quest = await createQuest(session.token, 'WEEKLY', 10);
      const res = await complete(session.token, quest.id);
      expect(res.status).toBe(201);

      const entry = await prisma.questEntry.findUniqueOrThrow({ where: { id: res.body.entry.id } });
      expect(entry.periodKey).toBe(periodKey('WEEKLY', 'UTC', entry.completedAt));
    });
  });

  describe('XP on /auth/me', () => {
    it('starts at 0 XP / level 1', async () => {
      const me = await getMe(session.token);
      expect(me).toMatchObject({ xp: 0, level: 1, progress: 0, xpToNext: 100 });
    });

    it('matches the entry sum after complete and after undo', async () => {
      const a = await createQuest(session.token, 'DAILY', 60);
      const b = await createQuest(session.token, 'WEEKLY', 90);

      const first = await complete(session.token, a.id);
      const second = await complete(session.token, b.id);
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      let me = await getMe(session.token);
      expect(me.xp).toBe(150);
      expect(me.xp).toBe(await entryXpSum(session.user.id));
      const expected = levelProgress(150);
      expect(me).toMatchObject({
        level: expected.level,
        progress: expected.progress,
        xpToNext: expected.xpToNext,
      });
      expect(me.level).toBe(2);

      expect((await undo(session.token, second.body.entry.id)).status).toBe(204);
      me = await getMe(session.token);
      expect(me.xp).toBe(60);
      expect(me.xp).toBe(await entryXpSum(session.user.id));
      expect(me.level).toBe(1);

      expect((await undo(session.token, first.body.entry.id)).status).toBe(204);
      me = await getMe(session.token);
      expect(me).toMatchObject({ xp: 0, level: 1 });
    });
  });

  describe('undo', () => {
    it('ONCE quest: deleting its only entry reverts status to ACTIVE and allows re-completion', async () => {
      const quest = await createQuest(session.token, 'ONCE', 25);

      const res = await complete(session.token, quest.id);
      expect(res.status).toBe(201);
      let stored = await prisma.quest.findUniqueOrThrow({ where: { id: quest.id } });
      expect(stored.status).toBe('COMPLETED');
      expect(stored.completedAt).not.toBeNull();

      expect((await undo(session.token, res.body.entry.id)).status).toBe(204);
      stored = await prisma.quest.findUniqueOrThrow({ where: { id: quest.id } });
      expect(stored.status).toBe('ACTIVE');
      expect(stored.completedAt).toBeNull();

      expect((await complete(session.token, quest.id)).status).toBe(201);
    });

    it('DAILY quest: undo frees today\'s slot', async () => {
      const quest = await createQuest(session.token, 'DAILY', 10);
      const res = await complete(session.token, quest.id);
      expect((await undo(session.token, res.body.entry.id)).status).toBe(204);
      expect((await complete(session.token, quest.id)).status).toBe(201);
    });
  });
});
