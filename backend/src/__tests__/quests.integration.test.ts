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

interface QuestPayload {
  title?: string;
  difficulty?: string;
  frequency?: string;
  xp_reward?: number;
  is_active?: boolean;
}

async function createQuest(token: string, overrides: QuestPayload = {}) {
  const res = await agent
    .post('/quests')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title ?? `Quest ${Date.now()}`,
      difficulty: overrides.difficulty ?? 'MEDIUM',
      frequency: overrides.frequency ?? 'DAILY',
      xp_reward: overrides.xp_reward ?? 10,
      is_active: overrides.is_active ?? true,
    });
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Quests integration', () => {
  let session: UserSession;

  beforeAll(async () => {
    await cleanDb();
    session = await registerAndLogin();
  });

  afterAll(async () => {
    await cleanDb();
  });

  // ── Create ─────────────────────────────────────────────────────────────

  describe('POST /quests', () => {
    it('creates a quest → 201 with correct shape', async () => {
      const res = await createQuest(session.token, {
        title: 'My Test Quest',
        difficulty: 'HARD',
        frequency: 'DAILY',
        xp_reward: 25,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('quest');
      const q = res.body.quest;
      expect(q.title).toBe('My Test Quest');
      expect(q.difficulty).toBe('HARD');
      expect(q.frequency).toBe('DAILY');
      expect(q.xp_reward).toBe(25);
      expect(q.status).toBe('ACTIVE');
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('streak');
      expect(q).toHaveProperty('strip');
    });
  });

  // ── List ───────────────────────────────────────────────────────────────

  describe('GET /quests', () => {
    it("lists the authenticated user's quests", async () => {
      // Seed a couple more
      await createQuest(session.token, { title: 'Quest A' });
      await createQuest(session.token, { title: 'Quest B' });

      const res = await agent
        .get('/quests')
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quests');
      expect(Array.isArray(res.body.quests)).toBe(true);
      expect(res.body.quests.length).toBeGreaterThanOrEqual(2);
      // All returned quests belong to this user (via ownership check in service)
      for (const q of res.body.quests) {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('title');
      }
    });
  });

  // ── Get by ID ──────────────────────────────────────────────────────────

  describe('GET /quests/:id', () => {
    it('returns quest by owner', async () => {
      const created = await createQuest(session.token, { title: 'Readable Quest' });
      const questId = created.body.quest.id;

      const res = await agent
        .get(`/quests/${questId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(200);
      expect(res.body.quest.id).toBe(questId);
      expect(res.body.quest.title).toBe('Readable Quest');
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────

  describe('PATCH /quests/:id', () => {
    it('updates fields', async () => {
      const created = await createQuest(session.token, { title: 'Before Update' });
      const questId = created.body.quest.id;

      const res = await agent
        .patch(`/quests/${questId}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ title: 'After Update', xp_reward: 50 });

      expect(res.status).toBe(200);
      expect(res.body.quest.title).toBe('After Update');
      expect(res.body.quest.xp_reward).toBe(50);
    });
  });

  // ── Archive ────────────────────────────────────────────────────────────

  describe('POST /quests/:id/archive', () => {
    it('sets status to ARCHIVED', async () => {
      const created = await createQuest(session.token, { title: 'To Archive' });
      const questId = created.body.quest.id;

      const res = await agent
        .post(`/quests/${questId}/archive`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(200);
      expect(res.body.quest.status).toBe('ARCHIVED');
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────

  describe('DELETE /quests/:id', () => {
    it('deletes a quest → 204', async () => {
      const created = await createQuest(session.token, { title: 'To Delete' });
      const questId = created.body.quest.id;

      const res = await agent
        .delete(`/quests/${questId}`)
        .set('Authorization', `Bearer ${session.token}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await agent
        .get(`/quests/${questId}`)
        .set('Authorization', `Bearer ${session.token}`);
      expect(getRes.status).toBe(404);
    });
  });

  // ── Ownership rejection ────────────────────────────────────────────────

  describe('ownership enforcement', () => {
    it("user B gets 404 when reading user A's quest (not 403)", async () => {
      const sessionA = await registerAndLogin();
      const sessionB = await registerAndLogin();

      const created = await createQuest(sessionA.token, { title: 'Private Quest' });
      const questId = created.body.quest.id;

      const res = await agent
        .get(`/quests/${questId}`)
        .set('Authorization', `Bearer ${sessionB.token}`);

      expect(res.status).toBe(404);
    });
  });
});
