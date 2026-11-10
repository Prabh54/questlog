/**
 * OpenAPI 3.0 document generated from the shared Zod schemas.
 *
 * The same schema objects validate requests (validate() middleware), type the
 * web client, and are checked against real responses in the contract tests,
 * so this document cannot silently drift from the code. A test also asserts
 * that every Express route appears here and vice versa.
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import * as S from '@questlog/shared';

// Patches the (single, hoisted) zod instance that @questlog/shared also uses
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token from /auth/login, /auth/register or /auth/refresh (15-minute lifetime).',
});
const refreshCookie = registry.registerComponent('securitySchemes', 'refreshCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: '__Host-ql_refresh',
  description:
    'HttpOnly, Secure, SameSite=Strict refresh-token cookie set by login/register/refresh ' +
    '(named `ql_refresh` outside production). Single-use: every refresh rotates it.',
});

// ── Named components ─────────────────────────────────────────────────────
/**
 * Names a shared schema *in place* so every schema that nests it (e.g. Quest
 * inside QuestResponse) emits a $ref instead of an inline copy. `.openapi()`
 * returns a clone, but the shared composites hold the original instance, so the
 * clone's metadata is copied back onto it. Kept to this one function; the
 * committed docs/openapi.json + CI drift check would catch any library change.
 */
function component<T extends ZodTypeAny>(name: string, schema: T): T {
  Object.assign(schema._def, { openapi: schema.openapi(name)._def.openapi });
  registry.register(name, schema);
  return schema;
}

const C = {
  Error: component('Error', S.ErrorResponseSchema),
  ValidationError: component('ValidationError', S.ValidationErrorResponseSchema),
  CategoryRef: component('CategoryRef', S.CategoryRefSchema),
  User: component('User', S.UserSchema),
  AuthResponse: component('AuthResponse', S.AuthResponseSchema),
  Category: component('Category', S.CategorySchema),
  StripDay: component('StripDay', S.StripDaySchema),
  Quest: component('Quest', S.QuestSchema),
  EntryQuest: component('EntryQuest', S.EntryQuestSchema),
  QuestEntry: component('QuestEntry', S.QuestEntrySchema),
  FeedResponse: component('FeedResponse', S.FeedResponseSchema),
  TodayQuest: component('TodayQuest', S.TodayQuestSchema),
  DashboardSummary: component('DashboardSummary', S.DashboardSummarySchema),
  TimeSeriesPoint: component('TimeSeriesPoint', S.TimeSeriesPointSchema),
  CompletionsResponse: component('CompletionsResponse', S.CompletionsResponseSchema),
  PerQuestStreak: component('PerQuestStreak', S.PerQuestStreakSchema),
  StreakSummary: component('StreakSummary', S.StreakSummarySchema),
  CategoryBreakdownRow: component('CategoryBreakdownRow', S.CategoryBreakdownRowSchema),
  CategoryBreakdown: component('CategoryBreakdown', S.CategoryBreakdownSchema),
  XpTimeSeriesPoint: component('XpTimeSeriesPoint', S.XpTimeSeriesPointSchema),
  XpTimeSeriesResponse: component('XpTimeSeriesResponse', S.XpTimeSeriesResponseSchema),
  QuestDifficulty: component('QuestDifficulty', S.QuestDifficultySchema),
  QuestFrequency: component('QuestFrequency', S.QuestFrequencySchema),
  QuestStatus: component('QuestStatus', S.QuestStatusSchema),
  RegisterBody: component('RegisterBody', S.RegisterSchema),
  LoginBody: component('LoginBody', S.LoginSchema),
  UpdateMeBody: component('UpdateMeBody', S.UpdateMeSchema),
  CreateQuestBody: component('CreateQuestBody', S.CreateQuestSchema),
  UpdateQuestBody: component('UpdateQuestBody', S.UpdateQuestSchema),
  CreateCategoryBody: component('CreateCategoryBody', S.CreateCategorySchema),
  UpdateCategoryBody: component('UpdateCategoryBody', S.UpdateCategorySchema),
  CompleteQuestBody: component('CompleteQuestBody', S.CompleteQuestSchema),
};

// ── Helpers ──────────────────────────────────────────────────────────────
const json = (schema: ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const noContent = { description: 'No content' };
const err = (description: string) => json(C.Error, description);
const errors = {
  400: json(C.ValidationError, 'Request failed validation'),
  401: err('Missing or invalid bearer token'),
  404: err('Not found, or owned by another user (never 403, so existence is not leaked)'),
  409: err('Conflict'),
};
const idParam = z.object({ id: z.string().openapi({ description: 'Resource id (cuid)' }) });
const body = (schema: ZodTypeAny) => ({
  body: { required: true, content: { 'application/json': { schema } } },
});

type Op = Omit<RouteConfig, 'method' | 'path' | 'responses'> & {
  responses: RouteConfig['responses'];
  auth?: boolean;
};

function route(method: RouteConfig['method'], path: string, op: Op) {
  const { auth = true, responses, ...rest } = op;
  registry.registerPath({
    method,
    path,
    ...(auth && { security: [{ [bearerAuth.name]: [] }] }),
    ...rest,
    responses: auth ? { 401: errors[401], ...responses } : responses,
  });
}

// ── System ───────────────────────────────────────────────────────────────
route('get', '/health', {
  tags: ['System'],
  summary: 'Liveness probe',
  auth: false,
  responses: {
    200: json(
      z.object({ status: z.literal('ok'), env: z.string(), timestamp: S.IsoDateTimeSchema }),
      'Service is up',
    ),
  },
});

// ── Auth ─────────────────────────────────────────────────────────────────
const setsRefreshCookie = {
  'Set-Cookie': {
    description: 'Rotated refresh token: `__Host-ql_refresh=…; HttpOnly; Secure; SameSite=Strict; Path=/`',
    schema: { type: 'string' as const },
  },
};
const authOk = (description: string) => ({ ...json(C.AuthResponse, description), headers: setsRefreshCookie });
const rateLimited = err('RATE_LIMITED — see the Retry-After header');
const badOrigin = err('FORBIDDEN_ORIGIN — browser request from another site');

route('post', '/auth/register', {
  tags: ['Auth'],
  summary: 'Create an account and start a session',
  auth: false,
  request: body(C.RegisterBody),
  responses: {
    201: authOk('Account created; returns an access token and sets the refresh cookie'),
    400: errors[400],
    409: err('EMAIL_TAKEN or USERNAME_TAKEN'),
    429: rateLimited,
  },
});
route('post', '/auth/login', {
  tags: ['Auth'],
  summary: 'Log in and start a session',
  description: 'Limited to 20 attempts per IP and 5 failed attempts per account per 15 minutes.',
  auth: false,
  request: body(C.LoginBody),
  responses: {
    200: authOk('Logged in; returns an access token and sets the refresh cookie'),
    400: errors[400],
    401: err('INVALID_CREDENTIALS'),
    429: rateLimited,
  },
});
route('post', '/auth/refresh', {
  tags: ['Auth'],
  summary: 'Rotate the refresh token and get a new access token',
  description:
    'Each refresh token works once. Presenting one that was already used revokes the whole ' +
    'session (reuse detection), logging out both the legitimate user and whoever copied it.',
  auth: false,
  security: [{ [refreshCookie.name]: [] }],
  responses: {
    200: authOk('New access token; the refresh cookie is replaced'),
    401: err('INVALID_REFRESH_TOKEN — missing, expired, revoked or reused; the cookie is cleared'),
    403: badOrigin,
    429: rateLimited,
  },
});
route('post', '/auth/logout', {
  tags: ['Auth'],
  summary: "End this device's session",
  description: 'Revokes the session behind the refresh cookie and clears it. Idempotent.',
  auth: false,
  security: [{ [refreshCookie.name]: [] }],
  responses: { 204: noContent, 403: badOrigin },
});
route('post', '/auth/logout-all', {
  tags: ['Auth'],
  summary: 'End every session on every device',
  responses: { 204: noContent },
});
route('get', '/auth/me', {
  tags: ['Auth'],
  summary: 'Current user with derived XP and level',
  responses: { 200: json(S.UserResponseSchema, 'The authenticated user') },
});
route('patch', '/auth/me', {
  tags: ['Auth'],
  summary: 'Update display name and/or timezone',
  request: body(C.UpdateMeBody),
  responses: {
    200: json(S.UserResponseSchema, 'Updated user'),
    400: errors[400],
    409: err('USERNAME_TAKEN'),
  },
});

// ── Categories ───────────────────────────────────────────────────────────
route('get', '/categories', {
  tags: ['Categories'],
  summary: 'List categories with quest counts',
  responses: { 200: json(S.CategoryListResponseSchema, 'Categories, oldest first') },
});
route('post', '/categories', {
  tags: ['Categories'],
  summary: 'Create a category',
  request: body(C.CreateCategoryBody),
  responses: {
    201: json(S.CategoryResponseSchema, 'Created'),
    400: errors[400],
    409: err('CATEGORY_NAME_TAKEN'),
  },
});
route('patch', '/categories/{id}', {
  tags: ['Categories'],
  summary: 'Update a category',
  request: { params: idParam, ...body(C.UpdateCategoryBody) },
  responses: {
    200: json(S.CategoryResponseSchema, 'Updated'),
    400: errors[400],
    404: errors[404],
    409: err('CATEGORY_NAME_TAKEN'),
  },
});
route('delete', '/categories/{id}', {
  tags: ['Categories'],
  summary: 'Delete a category (its quests become uncategorized)',
  request: { params: idParam },
  responses: { 204: noContent, 404: errors[404] },
});

// ── Quests ───────────────────────────────────────────────────────────────
route('get', '/quests', {
  tags: ['Quests'],
  summary: 'List quests with streaks and a 14-day strip',
  request: { query: S.ListQuestsQuerySchema },
  responses: { 200: json(S.QuestListResponseSchema, 'Matching quests'), 400: errors[400] },
});
route('post', '/quests', {
  tags: ['Quests'],
  summary: 'Create a quest',
  request: body(C.CreateQuestBody),
  responses: {
    201: json(S.QuestResponseSchema, 'Created'),
    400: errors[400],
    404: err('Category not found'),
  },
});
route('get', '/quests/{id}', {
  tags: ['Quests'],
  summary: 'Get a quest with full-history streak stats',
  request: { params: idParam },
  responses: { 200: json(S.QuestResponseSchema, 'The quest'), 404: errors[404] },
});
route('patch', '/quests/{id}', {
  tags: ['Quests'],
  summary: 'Update a quest',
  request: { params: idParam, ...body(C.UpdateQuestBody) },
  responses: {
    200: json(S.QuestResponseSchema, 'Updated'),
    400: errors[400],
    404: errors[404],
  },
});
route('delete', '/quests/{id}', {
  tags: ['Quests'],
  summary: 'Delete a quest and its entries',
  request: { params: idParam },
  responses: { 204: noContent, 404: errors[404] },
});
route('post', '/quests/{id}/archive', {
  tags: ['Quests'],
  summary: 'Archive a quest',
  request: { params: idParam },
  responses: { 200: json(S.QuestResponseSchema, 'Archived'), 404: errors[404] },
});
route('post', '/quests/{id}/unarchive', {
  tags: ['Quests'],
  summary: 'Unarchive a quest',
  request: { params: idParam },
  responses: { 200: json(S.QuestResponseSchema, 'Active again'), 404: errors[404] },
});
route('post', '/quests/{id}/complete', {
  tags: ['Quests'],
  summary: 'Log a completion for the current day / ISO week / month',
  description:
    'At most one completion per quest per period, enforced by a unique (quest_id, period_key) ' +
    'index, so concurrent requests yield exactly one 201.',
  request: { params: idParam, body: { content: { 'application/json': { schema: C.CompleteQuestBody } } } },
  responses: {
    201: json(S.EntryResponseSchema, 'Completion recorded'),
    400: json(z.union([C.Error, C.ValidationError]), 'QUEST_ARCHIVED, or VALIDATION_FAILED'),
    404: errors[404],
    409: err('ALREADY_COMPLETED_TODAY — already completed for the current period'),
  },
});

// ── Entries ──────────────────────────────────────────────────────────────
route('get', '/entries', {
  tags: ['Entries'],
  summary: 'Completion feed, newest first (keyset pagination)',
  request: { query: S.FeedQuerySchema },
  responses: { 200: json(C.FeedResponse, 'One page of entries'), 400: errors[400] },
});
route('get', '/entries/{id}', {
  tags: ['Entries'],
  summary: 'Get one entry',
  request: { params: idParam },
  responses: { 200: json(S.EntryResponseSchema, 'The entry'), 404: errors[404] },
});
route('delete', '/entries/{id}', {
  tags: ['Entries'],
  summary: 'Undo a completion (reopens a ONCE quest)',
  request: { params: idParam },
  responses: { 204: noContent, 404: errors[404] },
});

// ── Dashboard & analytics ────────────────────────────────────────────────
route('get', '/dashboard/summary', {
  tags: ['Analytics'],
  summary: "XP, level, today's quests and best streak",
  responses: { 200: json(C.DashboardSummary, 'Dashboard summary') },
});
route('get', '/analytics/completions', {
  tags: ['Analytics'],
  summary: 'Completion counts per day or week (gaps filled with 0)',
  request: { query: S.TimeSeriesQuerySchema },
  responses: { 200: json(C.CompletionsResponse, 'Time series'), 400: errors[400] },
});
route('get', '/analytics/streaks', {
  tags: ['Analytics'],
  summary: 'Current and longest streak per quest',
  responses: { 200: json(C.StreakSummary, 'Streak summary') },
});
route('get', '/analytics/categories', {
  tags: ['Analytics'],
  summary: 'Completions and XP by category',
  responses: { 200: json(C.CategoryBreakdown, 'Category breakdown') },
});
route('get', '/analytics/xp', {
  tags: ['Analytics'],
  summary: 'XP earned per bucket with cumulative XP and level',
  request: { query: S.TimeSeriesQuerySchema },
  responses: { 200: json(C.XpTimeSeriesResponse, 'XP time series'), 400: errors[400] },
});

// ── Introspection (used by the contract tests) ───────────────────────────
export interface DocumentedRoute {
  method: string;
  path: string;
  /** status code → Zod schema of the JSON body (undefined for bodiless responses) */
  responses: Record<string, ZodTypeAny | undefined>;
}

export function documentedRoutes(): DocumentedRoute[] {
  return registry.definitions.flatMap((def) => {
    if (def.type !== 'route') return [];
    const responses: DocumentedRoute['responses'] = {};
    for (const [status, response] of Object.entries(def.route.responses)) {
      const content = 'content' in response ? response.content : undefined;
      const schema = content?.['application/json']?.schema;
      responses[status] = schema instanceof z.ZodType ? schema : undefined;
    }
    return [{ method: def.route.method, path: def.route.path, responses }];
  });
}

// ── Document ─────────────────────────────────────────────────────────────
export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'QuestLog API',
      version: '1.0.0',
      description:
        'REST API for QuestLog, a gamified habit tracker. Generated from the Zod schemas in ' +
        '@questlog/shared.\n\n**Auth:** /auth/login returns a 15-minute access token (send it as ' +
        '`Authorization: Bearer <token>`) and sets a rotating, HttpOnly refresh-token cookie. ' +
        'Call /auth/refresh when the access token expires.',
    },
    servers: [{ url: '/' }],
  });
}
