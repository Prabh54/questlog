import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Helpers ───────────────────────────────────────────────────────────────

interface RegisterResult {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    xp: number;
    level: number;
    timezone: string;
  };
}

async function registerAndLogin(overrides: {
  email?: string;
  display_name?: string;
  password?: string;
} = {}): Promise<RegisterResult> {
  const ts = Date.now();
  const payload = {
    email: overrides.email ?? `user${ts}@test.com`,
    display_name: overrides.display_name ?? `user${ts}`,
    password: overrides.password ?? 'Password123!',
  };
  const res = await agent.post('/auth/register').send(payload);
  return res.body as RegisterResult;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Auth integration', () => {
  beforeAll(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
  });

  // ── POST /auth/register ────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('happy path → 201 with token and user', async () => {
      const ts = Date.now();
      const res = await agent.post('/auth/register').send({
        email: `happy${ts}@test.com`,
        display_name: `happy${ts}`,
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toMatchObject({
        email: `happy${ts}@test.com`,
        username: `happy${ts}`,
      });
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('duplicate email → 409', async () => {
      const ts = Date.now();
      const payload = {
        email: `dup${ts}@test.com`,
        display_name: `dup${ts}`,
        password: 'Password123!',
      };
      await agent.post('/auth/register').send(payload);

      const res = await agent.post('/auth/register').send({
        ...payload,
        display_name: `dup${ts}b`, // different username, same email
      });
      expect(res.status).toBe(409);
    });

    it('duplicate username → 409', async () => {
      const ts = Date.now();
      const payload = {
        email: `uname${ts}@test.com`,
        display_name: `uname${ts}`,
        password: 'Password123!',
      };
      await agent.post('/auth/register').send(payload);

      const res = await agent.post('/auth/register').send({
        email: `uname${ts}b@test.com`, // different email, same username
        display_name: `uname${ts}`,
        password: 'Password123!',
      });
      expect(res.status).toBe(409);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('happy path → 200 with token', async () => {
      const ts = Date.now();
      const email = `login${ts}@test.com`;
      await agent.post('/auth/register').send({
        email,
        display_name: `login${ts}`,
        password: 'Password123!',
      });

      const res = await agent.post('/auth/login').send({
        email,
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toMatchObject({ email });
    });

    it('wrong password → 401', async () => {
      const ts = Date.now();
      const email = `wrongpw${ts}@test.com`;
      await agent.post('/auth/register').send({
        email,
        display_name: `wrongpw${ts}`,
        password: 'Password123!',
      });

      const res = await agent.post('/auth/login').send({
        email,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('valid token → 200 with user', async () => {
      const { token, user } = await registerAndLogin();

      const res = await agent
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.email).toBe(user.email);
    });

    it('missing token → 401', async () => {
      const res = await agent.get('/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
