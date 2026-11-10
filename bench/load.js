/**
 * k6 load test: virtual users repeatedly open a real page of the app, firing
 * the same API calls the React app makes for it (in parallel, like the browser).
 *
 *   USERS=power  → only users with 3 years of history (~10k completions each)
 *   USERS=mixed  → 95% casual users, 5% power users
 *
 * Every request is tagged with its endpoint, so the summary reports
 * p50 / p95 / p99 per endpoint and per page.
 */
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';

// Wall time to load a whole page: all of its API calls, fired in parallel
const pageDuration = new Trend('page_duration', true);

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const POOL = __ENV.USERS || 'power';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '60s';

const power = new SharedArray('power', () => JSON.parse(open('./out/tokens.json')).power);
const casual = new SharedArray('casual', () => JSON.parse(open('./out/tokens.json')).casual);

export const options = {
  scenarios: {
    pages: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Not pass/fail gates; declaring them makes k6 report per-endpoint stats
    'http_req_duration{endpoint:dashboard_summary}': ['p(95)>=0'],
    'http_req_duration{endpoint:completions_30d}': ['p(95)>=0'],
    'http_req_duration{endpoint:completions_365d}': ['p(95)>=0'],
    'http_req_duration{endpoint:entries_feed}': ['p(95)>=0'],
    'http_req_duration{endpoint:streaks}': ['p(95)>=0'],
    'http_req_duration{endpoint:xp_30d}': ['p(95)>=0'],
    'http_req_duration{endpoint:categories_breakdown}': ['p(95)>=0'],
    'http_req_duration{endpoint:quests_list}': ['p(95)>=0'],
    'http_req_duration{endpoint:quest_detail}': ['p(95)>=0'],
    'http_req_duration{endpoint:me}': ['p(95)>=0'],
    'page_duration{page:dashboard}': ['p(95)>=0'],
    'page_duration{page:analytics}': ['p(95)>=0'],
    'page_duration{page:quests}': ['p(95)>=0'],
    'page_duration{page:quest_detail}': ['p(95)>=0'],
    http_req_failed: ['rate<0.01'],
  },
};

function pickUser() {
  const fromPower = POOL === 'power' || Math.random() < 0.05;
  const pool = fromPower ? power : casual;
  return pool[Math.floor(Math.random() * pool.length)];
}

const PAGES = {
  dashboard: (u) => [
    ['dashboard_summary', '/dashboard/summary'],
    ['completions_30d', '/analytics/completions?range=30d&bucket=day'],
    ['completions_365d', '/analytics/completions?range=365d&bucket=day'],
    ['entries_feed', '/entries?limit=5'],
    ['me', '/auth/me'],
  ],
  analytics: () => [
    ['streaks', '/analytics/streaks'],
    ['xp_30d', '/analytics/xp?range=30d&bucket=day'],
    ['categories_breakdown', '/analytics/categories'],
    ['completions_30d', '/analytics/completions?range=30d&bucket=day'],
  ],
  quests: () => [
    ['quests_list', '/quests?sort=newest'],
    ['categories', '/categories'],
  ],
  quest_detail: (u) => [
    ['quest_detail', `/quests/${u.questId}`],
    ['entries_feed', `/entries?quest_id=${u.questId}&limit=100`],
  ],
};
const PAGE_NAMES = Object.keys(PAGES);

export default function () {
  const user = pickUser();
  const page = PAGE_NAMES[Math.floor(Math.random() * PAGE_NAMES.length)];
  const params = (endpoint) => ({
    headers: { Authorization: `Bearer ${user.token}` },
    tags: { endpoint, page },
  });
  const started = Date.now();
  const responses = http.batch(
    PAGES[page](user).map(([endpoint, path]) => ['GET', `${BASE}${path}`, null, params(endpoint)]),
  );
  pageDuration.add(Date.now() - started, { page });
  for (const res of responses) check(res, { 'status 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  const name = __ENV.RESULT_NAME || `${POOL}`;
  return { [`/bench/out/${name}.json`]: JSON.stringify(data, null, 2) };
}
