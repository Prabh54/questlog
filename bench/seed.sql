-- Benchmark dataset: ~1.3M completions across 2,000 users.
--
--   * 1,900 casual users: 3–5 quests, 30–180 days of history, ~60% completion
--   * 100 power users:    12 quests, 3 years of history, ~85% completion
--                         (≈8.5k entries each: the worst case per request)
--
-- Users are spread over four timezones, and quests over all four frequencies,
-- so period keys and local-day bucketing are exercised at scale. Every row is
-- generated inside Postgres with generate_series (≈1 min). Deterministic:
-- setseed() fixes random(). Run against an empty, migrated database:
--
--   psql "$BENCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f bench/seed.sql

SELECT setseed(0.42);

BEGIN;

-- ── Users ─────────────────────────────────────────────────────────────────
-- Password for every bench user: BenchPassword1 (bcrypt cost 4, bench only)
INSERT INTO users (id, email, username, password, timezone, created_at, updated_at)
SELECT
  'bench-user-' || n,
  'bench' || n || '@questlog.test',
  'bench' || n,
  '$2a$04$S31eAireg38rVveoMbar.Oh6krAr8fWG.RJOxrZ7IMIGmS1Jo7lli',
  (ARRAY['UTC', 'America/Vancouver', 'Europe/London', 'Asia/Tokyo'])[1 + n % 4],
  now() - interval '3 years',
  now()
FROM generate_series(1, 2000) AS n;

-- ── Categories (4 per user) ───────────────────────────────────────────────
INSERT INTO categories (id, name, color, user_id, created_at, updated_at)
SELECT
  'bench-cat-' || u || '-' || c,
  (ARRAY['Health', 'Learning', 'Work', 'Home'])[c],
  (ARRAY['#22c55e', '#3b82f6', '#f59e0b', '#a855f7'])[c],
  'bench-user-' || u,
  now(), now()
FROM generate_series(1, 2000) AS u, generate_series(1, 4) AS c;

-- ── Quests ────────────────────────────────────────────────────────────────
-- Users 1..100 are power users (12 quests, 3 years); the rest are casual.
CREATE TEMP TABLE bench_quests AS
SELECT
  'bench-quest-' || u || '-' || q                                    AS id,
  'bench-user-' || u                                                 AS user_id,
  u,
  q,
  CASE WHEN u <= 100 THEN 1095 ELSE 30 + (u * 37 + q * 11) % 151 END AS history_days,
  CASE WHEN u <= 100 THEN 0.85 ELSE 0.60 END                         AS hit_rate,
  -- mostly DAILY, some WEEKLY, a few MONTHLY / ONCE
  CASE
    WHEN q = 12 THEN 'MONTHLY'
    WHEN q = 11 THEN 'ONCE'
    WHEN q % 6 = 5 THEN 'WEEKLY'
    ELSE 'DAILY'
  END::"QuestFrequency"                                              AS frequency,
  (ARRAY['EASY', 'MEDIUM', 'HARD', 'LEGENDARY'])[1 + q % 4]::"QuestDifficulty" AS difficulty,
  (ARRAY[5, 10, 25, 50])[1 + q % 4]                                  AS xp_reward
FROM generate_series(1, 2000) AS u,
     LATERAL generate_series(1, CASE WHEN u <= 100 THEN 12 ELSE 3 + u % 3 END) AS q;

INSERT INTO quests (id, title, status, difficulty, frequency, xp_reward, user_id, category_id,
                    created_at, updated_at)
SELECT
  id,
  'Bench quest ' || q,
  'ACTIVE',
  difficulty,
  frequency,
  xp_reward,
  user_id,
  'bench-cat-' || u || '-' || (1 + q % 4),
  now() - make_interval(days => history_days),
  now()
FROM bench_quests;

-- ── Entries ───────────────────────────────────────────────────────────────
-- One candidate per local day (DAILY), ISO week (WEEKLY) or month (MONTHLY),
-- kept with probability hit_rate. completed_at is a random local time that
-- day, converted to UTC; period_key is the local bucket start, exactly as
-- periodKey() in src/utils/dates.ts computes it.
WITH tz AS (
  SELECT bq.*, usr.timezone,
         (now() AT TIME ZONE usr.timezone)::date AS today_local
  FROM bench_quests bq
  JOIN users usr ON usr.id = bq.user_id
),
-- MATERIALIZED, and random() in the select list: a volatile function in a
-- WHERE clause that only references `tz` would be evaluated once per *quest*
-- (at tz's scan), making every quest all-or-nothing.
candidates AS MATERIALIZED (
  SELECT tz.id AS quest_id, tz.user_id, tz.xp_reward, tz.frequency, tz.timezone, tz.hit_rate,
         d::date AS local_day, random() AS roll
  FROM tz,
       LATERAL generate_series(tz.today_local - (tz.history_days - 1), tz.today_local - 1,
                               CASE tz.frequency
                                 WHEN 'WEEKLY' THEN interval '7 days'
                                 WHEN 'MONTHLY' THEN interval '1 month'
                                 ELSE interval '1 day'
                               END) AS d
  WHERE tz.frequency <> 'ONCE'
  UNION ALL
  -- ONCE quests: a single completion for about half of them
  SELECT tz.id, tz.user_id, tz.xp_reward, tz.frequency, tz.timezone, 0.5,
         tz.today_local - (tz.history_days / 2), random()
  FROM tz
  WHERE tz.frequency = 'ONCE'
)
INSERT INTO quest_entries (id, quest_id, user_id, xp_earned, period_key, completed_at,
                           created_at, updated_at)
SELECT
  'bench-entry-' || row_number() OVER (),
  quest_id,
  user_id,
  xp_reward,
  CASE frequency
    WHEN 'ONCE' THEN 'ONCE'
    WHEN 'WEEKLY' THEN to_char(date_trunc('week', local_day), 'YYYY-MM-DD')
    WHEN 'MONTHLY' THEN to_char(date_trunc('month', local_day), 'YYYY-MM-DD')
    ELSE to_char(local_day, 'YYYY-MM-DD')
  END,
  ts, ts, ts
FROM (
  SELECT c.*,
         -- local wall-clock time (06:00–23:00) → UTC, stored as naive UTC like Prisma does
         ((c.local_day + make_interval(mins => 360 + floor(random() * 1020)::int))
            AT TIME ZONE c.timezone) AT TIME ZONE 'UTC' AS ts
  FROM candidates c
  WHERE c.roll < c.hit_rate
) picked;

UPDATE quests q
SET status = 'COMPLETED', completed_at = e.completed_at
FROM quest_entries e
WHERE e.quest_id = q.id AND q.frequency = 'ONCE';

COMMIT;

ANALYZE;

SELECT
  (SELECT count(*) FROM users)         AS users,
  (SELECT count(*) FROM quests)        AS quests,
  (SELECT count(*) FROM quest_entries) AS entries,
  (SELECT max(c) FROM (SELECT count(*) c FROM quest_entries GROUP BY user_id) s) AS max_entries_per_user;
