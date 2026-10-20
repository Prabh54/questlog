-- ── Per-period uniqueness for quest_entries ─────────────────────────────
-- period_key identifies the completion bucket an entry belongs to: the local
-- date (in the user's timezone) that the day / ISO week / month starts on, or
-- 'ONCE'. Must match periodKey() in src/utils/dates.ts.
ALTER TABLE "quest_entries" ADD COLUMN "period_key" TEXT;

UPDATE "quest_entries" e
SET "period_key" = CASE q."frequency"
    WHEN 'ONCE' THEN 'ONCE'
    WHEN 'DAILY' THEN to_char(date_trunc('day', (e."completed_at" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone"), 'YYYY-MM-DD')
    WHEN 'WEEKLY' THEN to_char(date_trunc('week', (e."completed_at" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone"), 'YYYY-MM-DD')
    WHEN 'MONTHLY' THEN to_char(date_trunc('month', (e."completed_at" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone"), 'YYYY-MM-DD')
  END
FROM "quests" q, "users" u
WHERE q."id" = e."quest_id" AND u."id" = e."user_id";

-- Rows that already collide (double completions from the old race, or history
-- recorded under a different frequency/timezone) are kept, not deleted: the
-- earliest entry per bucket keeps the plain key and later ones get a
-- '#<entry id>' suffix so the unique index can be created.
UPDATE "quest_entries" e
SET "period_key" = e."period_key" || '#' || e."id"
FROM (
  SELECT "id",
         row_number() OVER (PARTITION BY "quest_id", "period_key" ORDER BY "completed_at", "id") AS rn
  FROM "quest_entries"
) d
WHERE d."id" = e."id" AND d.rn > 1;

ALTER TABLE "quest_entries" ALTER COLUMN "period_key" SET NOT NULL;

CREATE UNIQUE INDEX "quest_entries_quest_id_period_key_key"
    ON "quest_entries"("quest_id", "period_key");

-- ── XP / level are derived from quest_entries.xp_earned ──────────────────
ALTER TABLE "users" DROP COLUMN "xp";
ALTER TABLE "users" DROP COLUMN "level";
