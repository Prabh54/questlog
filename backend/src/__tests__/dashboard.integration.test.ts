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

async function createDailyQuest(token: string, xpReward = 10) {
  const res = await agent
    .post('/quests')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Dashboard Quest ${Date.now()}${Math.floor(Math.random() * 10000)}`,
      difficulty: 'EASY',
      frequency: 'DAILY',
      xp_reward: xpReward,
      is_active: true,
    });
  return res.body.quest as { id: string; xp_reward: number };
}

async function completeQuest(token: string, questId: string) {
  return agent
    .post(`/quests/${questId}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Dashboard integration', () => {
  beforeAll(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
  });

  describe('GET /dashboard/summary', () => {
    it('correctly aggregates XP, activeQuestCount, and todayCompletionPct', async () => {
      const session = await registerAndLogin();

      // Create 3 DAILY quests worth 10 XP each
      const q1 = await createDailyQuest(session.token, 10);
      const q2 = await createDailyQuest(session.token, 10);
      await createDailyQuest(session.token, 10);

      // Complete 2 of the 3 quests today
      const c1 = await completeQuest(session.token, q1.id);
      expect(c1.status).toBe(201);
      const c2 = await completeQuest(session.token, q2.id);
      expect(c2.status).toBe(201);

      // q3 is not completed

      const res = await agent
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(200);

      const summary = res.body;

      // totalXp = 10 + 10 = 20
      expect(summary.totalXp).toBe(20);

      // All 3 quests are still ACTIVE (DAILY completions don't change status)
      expect(summary.activeQuestCount).toBe(3);

      // todayCompletionPct = Math.round(2/3 * 100) = 67
      expect(summary.todayCompletionPct).toBe(67);
    });
  });
});
