# Performance: moving analytics into Postgres

**Result:** with 20 concurrent users loading pages, the API went from **18 to 252 requests/s** for users with three years of history, and the dashboard's p95 load time fell from **8.3 s to 0.38 s** (22× faster). For a realistic mix of users (95% casual, 5% heavy), throughput rose from 139 to 412 requests/s, and dashboard p95 fell from 1.2 s to 0.24 s. A repeat of both runs landed within about 5% of these numbers.

Everything below can be re-run with the scripts in [`bench/`](../bench).

## Setup

| | |
|---|---|
| Dataset | [`bench/seed.sql`](../bench/seed.sql): **1.29M completions**, 2,000 users, 8,801 quests, 4 timezones, all four frequencies |
| Heavy users | 100 "power users" with 12 quests and 3 years at ~85% completion: **~8.5k completions each** |
| Casual users | 1,900 users with 3–5 quests and 30–180 days at ~60% completion |
| API | Production Docker image, pinned to **1 vCPU / 512 MB** (the Fly.io machine size), `NODE_ENV=production` |
| Database | PostgreSQL 16.14 in Docker on the same laptop (Apple M2), not CPU-limited |
| Load | [k6](../bench/load.js): 20 virtual users for 60 s after a 15 s warm-up. Each iteration opens a random page (dashboard, analytics, quests, quest detail) and fires that page's API calls in parallel, exactly as the React app does. |
| Auth | Tokens minted ahead of time ([`bench/mint-tokens.cjs`](../bench/mint-tokens.cjs)), so login cost isn't measured |

Caveat: the database runs on the same machine as the API and isn't throttled, and absolute numbers depend on the laptop. The before/after comparison uses the same data, machine and limits.

## What was slow

Profiling a power user one request at a time, with Postgres statement logging on, showed:

1. **The database was not the bottleneck: Node was.** Each analytics query took 5–25 ms in Postgres, but the endpoints took 85–200 ms. They loaded every completion (~8.5k rows) through Prisma, then bucketed each row by local day with `formatInTimeZone` (Intl). On one vCPU, that CPU work queued every other request behind it: even `/auth/me`, a 5 ms query on its own, showed a p95 of 8 s under load.
2. **Prisma's nested `take` isn't applied in SQL.** The quest list asked for each quest's latest 60 entries (`include: { entries: { take: 60 } }`). Prisma fetched **all** entries of all quests, with every column, and trimmed them in memory.
3. **A correctness bug from that same `take: 60`.** Streaks and totals on the quest list were computed from at most 60 entries, so a quest with a 1,094-day streak showed "60" in the list but "1094" on its detail page.

## What changed

- **Aggregation in SQL** ([`stats.queries.ts`](../backend/src/services/stats.queries.ts)). Streaks, completion and XP time series, the category breakdown and the 14-day strip are each one query that returns at most one row per quest, bucket or category. Streak runs use the *gaps-and-islands* technique: `bucket − row_number()` is constant within a run of consecutive buckets.
- **Covering index:** `quest_entries(user_id, completed_at DESC, quest_id, xp_earned)` replaces `(user_id, completed_at DESC)`. These queries are now index-only scans (`Heap Fetches: 0`), and the `(user_id, completed_at)` prefix still serves the feed's keyset pagination. The columns are key columns rather than `INCLUDE`, because Prisma can't express `INCLUDE` and would silently drop it in a later migration (checked with `prisma migrate diff`).
- **The quest list and detail** no longer load entries at all. Both use the same two aggregate queries, which also fixes the 60-entry cap.

## Bugs caught along the way

- **Timezone database skew.** The first version bucketed rows with `AT TIME ZONE <user tz>` in SQL. The differential tests failed for `America/Vancouver`, and only around 1–3 November 2026. The Postgres image ships **tzdata 2026b** (British Columbia's 2026 rule change: no fall-back to UTC−8), while Node's ICU ships **tz 2026a**. The rest of the app (`periodKey`, day boundaries) uses Node's rules, so a late-evening completion could land on different days in different features. **Fix:** Node is now the single source of timezone rules. It computes the UTC start of every local day or week ([`local-buckets.ts`](../backend/src/utils/local-buckets.ts), cached per timezone and date), and Postgres assigns rows to buckets with `width_bucket(completed_at, starts)`.
- **A per-row cast made streaks 10× slower.** With the bucket starts passed as `$1::timestamptz[]`, Postgres re-ran the text → timestamptz cast of the ~1,100-element array **for every row**. Wrapping it in a scalar subquery, `(SELECT $1::timestamptz[])`, makes it run once per query: streaks dropped from ~2 s back to ~23 ms.
- **A seeding gotcha.** In `WHERE random() < rate`, the planner evaluated `random()` once per *quest* (at the scan of the only table the clause referenced), so every quest got either all of its days or none. The roll now happens per generated row in a materialized CTE.

## Correctness

[`stats-equivalence.integration.test.ts`](../backend/src/__tests__/stats-equivalence.integration.test.ts) compares every SQL aggregate with the original TypeScript (`calculateStreak` and the old JS bucketing):

- **Data:** seeded random 400-day histories in 7 timezones, including UTC−3:30 with DST, UTC+5:45, UTC+14, UTC−11, and `America/Santiago`, where DST switches at midnight so some local days start at 01:00.
- **Streaks** are checked at 8 different "now" instants each, covering a streak continuing today, the grace period and a broken streak.
- **Proven to work:** breaking the SQL grace-period rule fails all 7 timezones.
- **Regression test:** an 80-day streak now shows 80 in the list (it was capped at 60).

## Single-request latency (power user, no load)

| Endpoint | Before | After |
|---|---|---|
| `GET /dashboard/summary` | 175 ms | 30 ms |
| `GET /analytics/streaks` | 180 ms | 23 ms |
| `GET /analytics/categories` | 85 ms | 12 ms |
| `GET /quests` | 52 ms | 30 ms |
| `GET /quests/:id` | 40 ms | 14 ms |
| `GET /analytics/xp?range=30d` | 35 ms | 6 ms |
| `GET /analytics/completions?range=365d` | 27 ms | 7 ms |

## Under load (20 concurrent users, run 1)

Run 2 of both versions landed within about 5% of these numbers: power-user throughput was 19 → 255 req/s, and dashboard p95 was 9.3 s → 0.36 s. Run 2's "before" happened to run with the new covering index already in place, and it was no faster. That confirms the old bottleneck was Node, not the database.

### Power users (~8.5k completions each)

| Page (all its API calls in parallel) | Before p50 / p95 | After p50 / p95 |
|---|---|---|
| Dashboard | 4,440 / 8,324 ms | 296 / 376 ms (**22× faster p95**) |
| Analytics | 4,360 / 8,306 ms | 283 / 358 ms (23×) |
| Quests | 2,038 / 3,216 ms | 227 / 294 ms (11×) |
| Quest detail | 2,089 / 3,268 ms | 208 / 270 ms (12×) |
| **Throughput** | **18 req/s** (5.6 page loads/s) | **252 req/s** (76.9 page loads/s), **14×** |

### Mixed (95% casual, 5% power users)

| Page | Before p50 / p95 | After p50 / p95 |
|---|---|---|
| Dashboard | 520 / 1,203 ms | 179 / 235 ms (5.1×) |
| Analytics | 509 / 1,193 ms | 177 / 222 ms (5.4×) |
| Quests | 280 / 661 ms | 134 / 196 ms (3.4×) |
| Quest detail | 276 / 695 ms | 132 / 193 ms (3.6×) |
| **Throughput** | **139 req/s** | **412 req/s**, **3×** |

0 failed requests in every run. The per-endpoint breakdown is printed by `python3 bench/report.py before after`.

## Reproduce

```bash
docker compose -f docker-compose.dev.yml up -d db
docker exec questlog-dev-db-1 psql -U questlog -d postgres -c "CREATE DATABASE questlog_bench"
DATABASE_URL=postgresql://questlog:questlog@localhost:5432/questlog_bench npx prisma migrate deploy --schema backend/prisma/schema.prisma
docker exec -i questlog-dev-db-1 psql -U questlog -d questlog_bench -v ON_ERROR_STOP=1 < bench/seed.sql   # ~1 min

export BENCH_JWT_SECRET=$(openssl rand -hex 32)
node bench/mint-tokens.cjs
docker build -f backend/Dockerfile --target runner -t questlog-api:after .
bench/run.sh after questlog-api:after          # ~2.5 min
python3 bench/report.py after
```

To compare against an older commit, build it as another image (e.g. `questlog-api:before`), run `bench/run.sh before questlog-api:before`, then `python3 bench/report.py before after`.
