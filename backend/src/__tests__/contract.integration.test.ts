/**
 * API contract tests.
 *
 * Every request goes through `call()`, which checks that the response status
 * is one the OpenAPI document declares for that operation and that the JSON
 * body parses against the declared @questlog/shared schema (all response
 * schemas are .strict(), so extra or missing fields fail too). The suite
 * finishes by asserting that every documented operation was exercised, and
 * that the Express router and the document list exactly the same routes.
 */
import type { Router } from 'express';
import { ZodError } from 'zod';
import { apiRouters } from '../app';
import { documentedRoutes, type DocumentedRoute } from '../openapi/spec';
import { agent } from './helpers/app';
import { cleanDb } from './helpers/db';

// ── Contract-checking request helper ──────────────────────────────────────

const routes = documentedRoutes();
const routeKey = (method: string, path: string) => `${method.toUpperCase()} ${path}`;
const byKey = new Map(routes.map((r) => [routeKey(r.method, r.path), r]));
const exercised = new Set<string>(); // "METHOD /path STATUS"

type Method = 'get' | 'post' | 'patch' | 'delete';

interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  token?: string;
  expect: number;
}

async function call(method: Method, template: string, opts: CallOptions) {
  const route: DocumentedRoute | undefined = byKey.get(routeKey(method, template));
  if (!route) throw new Error(`${routeKey(method, template)} is not in the OpenAPI document`);

  const url = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = opts.params?.[name];
    if (value === undefined) throw new Error(`missing path param ${name}`);
    return encodeURIComponent(value);
  });

  let req = agent[method](url);
  if (opts.query) req = req.query(opts.query);
  if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
  const res = opts.body === undefined ? await req : await req.send(opts.body as object);

  const status = String(res.status);
  expect({ op: routeKey(method, template), status: res.status, body: res.body }).toMatchObject({
    status: opts.expect,
  });
  if (!(status in route.responses)) {
    throw new Error(`${routeKey(method, template)} returned undocumented status ${status}`);
  }

  const schema = route.responses[status];
  if (schema) {
    try {
      schema.parse(res.body);
    } catch (err) {
      const issues = err instanceof ZodError ? JSON.stringify(err.issues, null, 2) : String(err);
      throw new Error(
        `${routeKey(method, template)} ${status} does not match its documented schema:\n${issues}`,
      );
    }
  } else {
    expect(res.body).toEqual({}); // bodiless (204)
  }

  exercised.add(`${routeKey(method, template)} ${status}`);
  return res;
}

// ── Fixtures ──────────────────────────────────────────────────────────────

interface Session {
  token: string;
  user: { id: string };
}

async function register(): Promise<Session> {
  const ts = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const res = await call('post', '/auth/register', {
    body: { email: `contract${ts}@test.com`, display_name: `c${ts}`, password: 'Password123' },
    expect: 201,
  });
  return res.body as Session;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('API contract (responses match the OpenAPI document)', () => {
  let alice: Session;
  let bob: Session;
  let categoryId: string;
  let dailyQuestId: string;
  let onceQuestId: string;
  let entryId: string;

  beforeAll(async () => {
    await cleanDb();
    alice = await register();
    bob = await register();
  });

  afterAll(async () => {
    await cleanDb();
  });

  it('system: /health', async () => {
    await call('get', '/health', { expect: 200 });
  });

  it('auth: login, me, update me, logout and their errors', async () => {
    const me = await call('get', '/auth/me', { token: alice.token, expect: 200 });
    const email = me.body.user.email as string;

    await call('post', '/auth/login', {
      body: { email, password: 'Password123' },
      expect: 200,
    });
    await call('post', '/auth/login', {
      body: { email, password: 'wrong-password1' },
      expect: 401,
    });
    await call('post', '/auth/login', { body: { email: 'not-an-email' }, expect: 400 });
    await call('post', '/auth/register', {
      body: { email, display_name: 'someone_new', password: 'Password123' },
      expect: 409,
    });

    await call('patch', '/auth/me', {
      token: alice.token,
      body: { timezone: 'America/Vancouver' },
      expect: 200,
    });
    await call('patch', '/auth/me', {
      token: alice.token,
      body: { timezone: 'Mars/Olympus_Mons' },
      expect: 400,
    });

    await call('get', '/auth/me', { expect: 401 });
    await call('get', '/auth/me', { token: 'not-a-jwt', expect: 401 });
    await call('post', '/auth/logout', { token: alice.token, expect: 204 });
  });

  it('categories: create, list, update, conflicts and validation', async () => {
    const created = await call('post', '/categories', {
      token: alice.token,
      body: { name: 'Fitness', color: '#22c55e' },
      expect: 201,
    });
    categoryId = created.body.category.id;

    await call('post', '/categories', {
      token: alice.token,
      body: { name: 'Fitness' },
      expect: 409,
    });
    await call('post', '/categories', {
      token: alice.token,
      body: { name: 'Bad colour', color: 'green' },
      expect: 400,
    });
    await call('patch', '/categories/{id}', {
      token: alice.token,
      params: { id: categoryId },
      body: { description: 'Move every day' },
      expect: 200,
    });
    await call('get', '/categories', { token: alice.token, expect: 200 });
  });

  it('quests: create, list with filters, read, update, archive', async () => {
    const daily = await call('post', '/quests', {
      token: alice.token,
      body: { title: 'Run 5k', frequency: 'DAILY', xp_reward: 25, category_id: categoryId },
      expect: 201,
    });
    dailyQuestId = daily.body.quest.id;

    const once = await call('post', '/quests', {
      token: alice.token,
      body: { title: 'Sign up for a race', frequency: 'ONCE', difficulty: 'HARD' },
      expect: 201,
    });
    onceQuestId = once.body.quest.id;

    await call('post', '/quests', {
      token: alice.token,
      body: { title: '', xp_reward: 1000 },
      expect: 400,
    });
    await call('post', '/quests', {
      token: alice.token,
      body: { title: 'Orphan', category_id: 'does-not-exist' },
      expect: 404,
    });

    await call('get', '/quests', {
      token: alice.token,
      query: { difficulty: 'MEDIUM', sort: 'xp_desc', search: 'run' },
      expect: 200,
    });
    // Regression: invalid query strings used to surface as 500s
    await call('get', '/quests', { token: alice.token, query: { difficulty: 'IMPOSSIBLE' }, expect: 400 });

    await call('get', '/quests/{id}', { token: alice.token, params: { id: dailyQuestId }, expect: 200 });
    await call('get', '/quests/{id}', { token: bob.token, params: { id: dailyQuestId }, expect: 404 });
    await call('patch', '/quests/{id}', {
      token: alice.token,
      params: { id: dailyQuestId },
      body: { xp_reward: 30, description: 'Easy pace' },
      expect: 200,
    });
    await call('patch', '/quests/{id}', {
      token: alice.token,
      params: { id: dailyQuestId },
      body: { xp_reward: 3 },
      expect: 400,
    });
  });

  it('completions and the entry feed', async () => {
    const done = await call('post', '/quests/{id}/complete', {
      token: alice.token,
      params: { id: dailyQuestId },
      body: { note: 'Felt great' },
      expect: 201,
    });
    entryId = done.body.entry.id;

    await call('post', '/quests/{id}/complete', {
      token: alice.token,
      params: { id: dailyQuestId },
      body: {},
      expect: 409,
    });
    await call('post', '/quests/{id}/complete', {
      token: alice.token,
      params: { id: onceQuestId },
      body: {},
      expect: 201,
    });
    await call('post', '/quests/{id}/complete', {
      token: bob.token,
      params: { id: dailyQuestId },
      body: {},
      expect: 404,
    });

    // A completed quest now has a streak, strip day and populated stats
    await call('get', '/quests', { token: alice.token, expect: 200 });

    await call('get', '/entries', { token: alice.token, query: { limit: '1' }, expect: 200 });
    await call('get', '/entries', { token: alice.token, query: { limit: '0' }, expect: 400 });
    await call('get', '/entries/{id}', { token: alice.token, params: { id: entryId }, expect: 200 });
    await call('get', '/entries/{id}', { token: bob.token, params: { id: entryId }, expect: 404 });
  });

  it('dashboard and analytics', async () => {
    await call('get', '/dashboard/summary', { token: alice.token, expect: 200 });
    for (const bucket of ['day', 'week']) {
      await call('get', '/analytics/completions', {
        token: alice.token,
        query: { range: '7d', bucket },
        expect: 200,
      });
      await call('get', '/analytics/xp', {
        token: alice.token,
        query: { range: 'all', bucket },
        expect: 200,
      });
    }
    await call('get', '/analytics/completions', {
      token: alice.token,
      query: { range: '2y' },
      expect: 400,
    });
    await call('get', '/analytics/streaks', { token: alice.token, expect: 200 });
    await call('get', '/analytics/categories', { token: alice.token, expect: 200 });

    // Empty-state shapes are part of the contract too
    await call('get', '/dashboard/summary', { token: bob.token, expect: 200 });
    await call('get', '/analytics/xp', { token: bob.token, expect: 200 });
  });

  it('deletes: undo, unarchive, archive, remove', async () => {
    await call('delete', '/entries/{id}', { token: alice.token, params: { id: entryId }, expect: 204 });
    await call('delete', '/entries/{id}', { token: alice.token, params: { id: entryId }, expect: 404 });

    await call('post', '/quests/{id}/archive', { token: alice.token, params: { id: dailyQuestId }, expect: 200 });
    await call('post', '/quests/{id}/archive', { token: bob.token, params: { id: dailyQuestId }, expect: 404 });
    await call('post', '/quests/{id}/unarchive', { token: alice.token, params: { id: dailyQuestId }, expect: 200 });
    await call('post', '/quests/{id}/unarchive', { token: bob.token, params: { id: dailyQuestId }, expect: 404 });

    await call('delete', '/quests/{id}', { token: bob.token, params: { id: dailyQuestId }, expect: 404 });
    await call('delete', '/quests/{id}', { token: alice.token, params: { id: dailyQuestId }, expect: 204 });

    await call('patch', '/categories/{id}', {
      token: bob.token,
      params: { id: categoryId },
      body: { name: 'Mine now' },
      expect: 404,
    });
    await call('delete', '/categories/{id}', { token: bob.token, params: { id: categoryId }, expect: 404 });
    await call('delete', '/categories/{id}', { token: alice.token, params: { id: categoryId }, expect: 204 });
  });

  it('exercised every documented operation with its success status', () => {
    const missing = routes
      .map((r) => {
        const success = Object.keys(r.responses).find((s) => s.startsWith('2'));
        return `${routeKey(r.method, r.path)} ${success}`;
      })
      .filter((key) => !exercised.has(key));
    expect(missing).toEqual([]);
  });
});

describe('OpenAPI document coverage', () => {
  /** Express "/:id/archive" → OpenAPI "/{id}/archive" */
  const toOpenApiPath = (p: string) => p.replace(/:(\w+)/g, '{$1}');

  function expressRoutes(): string[] {
    const keys: string[] = [routeKey('get', '/health')];
    for (const [prefix, router] of Object.entries(apiRouters)) {
      for (const layer of (router as Router).stack) {
        if (!layer.route) continue;
        const path = layer.route.path === '/' ? prefix : `${prefix}${layer.route.path}`;
        for (const method of Object.keys((layer.route as unknown as { methods: object }).methods)) {
          keys.push(routeKey(method, toOpenApiPath(path)));
        }
      }
    }
    return keys.sort();
  }

  it('documents exactly the routes Express serves', () => {
    const documented = routes.map((r) => routeKey(r.method, r.path)).sort();
    expect(documented).toEqual(expressRoutes());
    expect(documented).toHaveLength(26); // 25 API endpoints + /health
  });
});
