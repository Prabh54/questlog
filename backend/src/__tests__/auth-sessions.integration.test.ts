import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { hashRefreshToken } from '../lib/tokens';
import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Helpers ───────────────────────────────────────────────────────────────

const PASSWORD = 'Password123';

interface Login {
  token: string;
  userId: string;
  email: string;
  /** "ql_refresh=<token>" */
  cookie: string;
  /** the raw refresh token */
  refreshToken: string;
  setCookie: string;
}

function readCookie(res: request.Response): { cookie: string; value: string; raw: string } {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) =>
    c.startsWith('ql_refresh='),
  );
  if (!raw) throw new Error(`no refresh cookie (status ${res.status})`);
  const cookie = raw.split(';')[0];
  return { cookie, value: cookie.slice('ql_refresh='.length), raw };
}

function asLogin(res: request.Response): Login {
  const { cookie, value, raw } = readCookie(res);
  return {
    token: res.body.token,
    userId: res.body.user.id,
    email: res.body.user.email,
    cookie,
    refreshToken: value,
    setCookie: raw,
  };
}

async function registerUser(): Promise<Login> {
  const ts = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const res = await agent
    .post('/auth/register')
    .send({ email: `s${ts}@test.com`, display_name: `s${ts}`, password: PASSWORD });
  expect(res.status).toBe(201);
  return asLogin(res);
}

async function login(email: string): Promise<Login> {
  const res = await agent.post('/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return asLogin(res);
}

const refresh = (cookie?: string) => {
  const req = agent.post('/auth/refresh');
  return cookie ? req.set('Cookie', cookie) : req;
};

const me = (token: string) => agent.get('/auth/me').set('Authorization', `Bearer ${token}`);

async function sessionOf(refreshToken: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { session: true },
  });
  return row!.session;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Auth sessions', () => {
  beforeAll(async () => {
    await cleanDb();
  });
  afterAll(async () => {
    await cleanDb();
  });

  describe('login', () => {
    it('sets an HttpOnly, SameSite=Strict refresh cookie and keeps it out of the body', async () => {
      const s = await registerUser();

      expect(s.setCookie).toMatch(/HttpOnly/i);
      expect(s.setCookie).toMatch(/SameSite=Strict/i);
      expect(s.setCookie).toMatch(/Path=\//);
      const expires = new Date(/Expires=([^;]+)/.exec(s.setCookie)![1]).getTime();
      expect(expires - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
      expect(expires - Date.now()).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);

      const res = await agent.post('/auth/login').send({ email: s.email, password: PASSWORD });
      expect(JSON.stringify(res.body)).not.toContain(readCookie(res).value);
      expect(res.body.expiresIn).toBe(900);
    });

    it('stores only a hash of the refresh token', async () => {
      const s = await registerUser();
      const raw = await prisma.refreshToken.findFirst({ where: { tokenHash: s.refreshToken } });
      expect(raw).toBeNull();
      const hashed = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(s.refreshToken) },
      });
      expect(hashed).not.toBeNull();
    });

    it('issues an access token that expires in 15 minutes and names its session', async () => {
      const s = await registerUser();
      const claims = jwt.decode(s.token) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(900);
      expect(claims.sub).toBe(s.userId);
      expect(claims.sid).toBe((await sessionOf(s.refreshToken)).id);
    });
  });

  describe('refresh', () => {
    it('rotates: returns a new access token and a new single-use refresh cookie', async () => {
      const s = await registerUser();

      const res = await refresh(s.cookie);
      expect(res.status).toBe(200);
      const next = readCookie(res);
      expect(next.value).not.toBe(s.refreshToken);
      expect((await me(res.body.token)).status).toBe(200);

      // The successor keeps working
      expect((await refresh(next.cookie)).status).toBe(200);
    });

    it('reuse of a rotated token revokes the whole session', async () => {
      const s = await registerUser();
      const rotated = readCookie(await refresh(s.cookie));

      // An attacker replays the old token…
      const replay = await refresh(s.cookie);
      expect(replay.status).toBe(401);
      expect(replay.body.error).toBe('INVALID_REFRESH_TOKEN');
      expect(readCookie(replay).raw).toMatch(/Expires=Thu, 01 Jan 1970/); // cleared

      // …so the legitimate successor is dead too
      expect((await refresh(rotated.cookie)).status).toBe(401);
      const session = await sessionOf(s.refreshToken);
      expect(session.revokedReason).toBe('REUSE_DETECTED');
    });

    it('is race-safe: 5 parallel refreshes with one token → exactly one succeeds', async () => {
      const s = await registerUser();
      const results = await Promise.all(Array.from({ length: 5 }, () => refresh(s.cookie)));
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 401, 401, 401, 401]);

      // The losers count as reuse, so the session is gone
      expect((await sessionOf(s.refreshToken)).revokedAt).not.toBeNull();
    });

    it('rejects a missing, unknown, idle-expired or past-lifetime token', async () => {
      expect((await refresh()).status).toBe(401);
      expect((await refresh('ql_refresh=not-a-real-token')).status).toBe(401);

      const idle = await registerUser();
      await prisma.refreshToken.update({
        where: { tokenHash: hashRefreshToken(idle.refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await refresh(idle.cookie)).status).toBe(401);

      const old = await registerUser();
      await prisma.session.update({
        where: { id: (await sessionOf(old.refreshToken)).id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await refresh(old.cookie)).status).toBe(401);
    });

    it('never extends a session past its absolute lifetime', async () => {
      const s = await registerUser();
      const sessionId = (await sessionOf(s.refreshToken)).id;
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.session.update({ where: { id: sessionId }, data: { expiresAt: soon } });

      const next = readCookie(await refresh(s.cookie));
      const row = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(next.value) },
      });
      expect(row!.expiresAt.getTime()).toBe(soon.getTime());
    });

    it('rejects browser requests from another origin (CSRF)', async () => {
      const s = await registerUser();
      const evil = await refresh(s.cookie).set('Origin', 'https://evil.example');
      expect(evil.status).toBe(403);
      const crossSite = await refresh(s.cookie).set('Sec-Fetch-Site', 'cross-site');
      expect(crossSite.status).toBe(403);
      const ours = await refresh(s.cookie).set('Origin', 'http://localhost:5173');
      expect(ours.status).toBe(200);
    });
  });

  describe('logout', () => {
    it("revokes only this device's session", async () => {
      const laptop = await registerUser();
      const phone = await login(laptop.email);

      const res = await agent.post('/auth/logout').set('Cookie', laptop.cookie);
      expect(res.status).toBe(204);
      expect(readCookie(res).raw).toMatch(/Expires=Thu, 01 Jan 1970/);

      expect((await refresh(laptop.cookie)).status).toBe(401);
      expect((await refresh(phone.cookie)).status).toBe(200);
      expect((await sessionOf(laptop.refreshToken)).revokedReason).toBe('LOGOUT');
    });

    it('logout-all revokes every session of the user', async () => {
      const a = await registerUser();
      const b = await login(a.email);
      const stranger = await registerUser();

      expect(
        (await agent.post('/auth/logout-all').set('Authorization', `Bearer ${a.token}`)).status,
      ).toBe(204);
      expect((await refresh(a.cookie)).status).toBe(401);
      expect((await refresh(b.cookie)).status).toBe(401);
      expect((await refresh(stranger.cookie)).status).toBe(200);
    });
  });

  describe('access tokens', () => {
    const secret = process.env.JWT_SECRET!;

    it('rejects expired, unsigned, wrong-audience and legacy tokens', async () => {
      const s = await registerUser();
      const sid = (await sessionOf(s.refreshToken)).id;
      const base = { email: s.email, sid };
      const opts = { subject: s.userId, issuer: 'questlog-api', audience: 'questlog' };

      const expired = jwt.sign({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }, secret, opts);
      const unsigned = jwt.sign(base, '', { ...opts, algorithm: 'none' });
      const wrongAudience = jwt.sign(base, secret, { ...opts, audience: 'someone-else' });
      const legacy = jwt.sign({ id: s.userId, email: s.email }, secret, { expiresIn: '7d' });

      for (const token of [expired, unsigned, wrongAudience, legacy]) {
        expect((await me(token)).status).toBe(401);
      }
      expect((await me(s.token)).status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('locks an account after 5 failed logins, without blocking other accounts', async () => {
      const limited = request(createApp({ rateLimit: true }));
      const victim = await registerUser();
      const bystander = await registerUser();

      for (let i = 0; i < 5; i++) {
        const res = await limited.post('/auth/login').send({ email: victim.email, password: 'wrong-pass1' });
        expect(res.status).toBe(401);
      }
      const blocked = await limited.post('/auth/login').send({ email: victim.email, password: PASSWORD });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      const other = await limited.post('/auth/login').send({ email: bystander.email, password: PASSWORD });
      expect(other.status).toBe(200);
    });

    it('does not count successful logins against the account', async () => {
      const limited = request(createApp({ rateLimit: true }));
      const s = await registerUser();
      for (let i = 0; i < 8; i++) {
        const res = await limited.post('/auth/login').send({ email: s.email, password: PASSWORD });
        expect(res.status).toBe(200);
      }
    });

    it('limits sign-ups per IP', async () => {
      const limited = request(createApp({ rateLimit: true }));
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const ts = `${Date.now()}${i}`;
        const res = await limited
          .post('/auth/register')
          .send({ email: `rl${ts}@test.com`, display_name: `rl${ts}`, password: PASSWORD });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
      expect(statuses[10]).toBe(429);
    });
  });
});
