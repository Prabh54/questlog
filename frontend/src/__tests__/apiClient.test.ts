import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ApiModule = typeof import('../lib/api');

const user = {
  id: 'u1',
  email: 'hero@example.com',
  username: 'hero',
  role: 'USER',
  xp: 0,
  level: 1,
  xpToNext: 100,
  progress: 0,
  timezone: 'UTC',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface FakeServer {
  refreshOk: boolean;
  refreshCalls: number;
  validToken: string;
}

/** A tiny fake API: /quests needs `Bearer <validToken>`; /auth/refresh issues it. */
function installFetch(server: FakeServer) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.endsWith('/auth/refresh')) {
      server.refreshCalls++;
      await new Promise((r) => setTimeout(r, 10)); // let concurrent callers pile up
      return server.refreshOk
        ? json(200, { token: server.validToken, expiresIn: 900, user })
        : json(401, { error: 'INVALID_REFRESH_TOKEN', message: 'Session expired' });
    }
    if (url.endsWith('/auth/login')) {
      return json(401, { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    if (headers['Authorization'] === `Bearer ${server.validToken}`) {
      return json(200, { quests: [] });
    }
    return json(401, { error: 'UNAUTHORIZED', message: 'Authentication required' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('API client session handling', () => {
  let mod: ApiModule;
  let server: FakeServer;

  beforeEach(async () => {
    vi.resetModules(); // fresh in-memory token and in-flight state per test
    mod = await import('../lib/api');
    server = { refreshOk: true, refreshCalls: 0, validToken: 'fresh-access-token' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes once on 401 and retries the request with the new access token', async () => {
    const fetchMock = installFetch(server);
    mod.setAccessToken('expired-token');

    await expect(mod.api.get('/quests')).resolves.toEqual({ quests: [] });
    expect(server.refreshCalls).toBe(1);

    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toEqual(['/api/quests', '/api/auth/refresh', '/api/quests']);
  });

  it('shares a single refresh between concurrent requests', async () => {
    installFetch(server);
    mod.setAccessToken('expired-token');

    const results = await Promise.all([
      mod.api.get('/quests'),
      mod.api.get('/quests'),
      mod.api.get('/quests'),
    ]);
    expect(results).toHaveLength(3);
    expect(server.refreshCalls).toBe(1); // a second refresh would look like token theft
  });

  it('ends the session when the refresh token is rejected', async () => {
    server.refreshOk = false;
    installFetch(server);
    const ended = vi.fn();
    mod.onSessionEnded(ended);

    await expect(mod.api.get('/quests')).rejects.toMatchObject({ status: 401 });
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh when the credentials themselves are wrong', async () => {
    installFetch(server);
    await expect(
      mod.api.post('/auth/login', { email: 'a@b.co', password: 'nope' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(server.refreshCalls).toBe(0);
  });

  it('never writes the access token to web storage', async () => {
    installFetch(server);
    mod.setAccessToken('expired-token');
    await mod.api.get('/quests');
    expect(JSON.stringify({ ...localStorage })).not.toContain(server.validToken);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(server.validToken);
  });
});
