-- NOTE: this migration restructures quest_entries. If the table has existing
-- rows, truncate it first (`TRUNCATE TABLE "quest_entries";`).

-- ── User timezone ─────────────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- ── Restructure quest_entries ─────────────────────────────────────────────
-- Drop old indexes
DROP INDEX IF EXISTS "quest_entries_quest_id_date_idx";
DROP INDEX IF EXISTS "quest_entries_date_idx";

-- Drop status column and EntryStatus enum (completion is now binary)
ALTER TABLE "quest_entries" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "EntryStatus";

-- Rename date → completed_at, notes → note
ALTER TABLE "quest_entries" RENAME COLUMN "date" TO "completed_at";
ALTER TABLE "quest_entries" RENAME COLUMN "notes" TO "note";

-- Add denormalized user_id + xp_earned snapshot
ALTER TABLE "quest_entries" ADD COLUMN "user_id" TEXT NOT NULL;
ALTER TABLE "quest_entries" ADD COLUMN "xp_earned" INTEGER NOT NULL;

-- Foreign key on user_id
ALTER TABLE "quest_entries" ADD CONSTRAINT "quest_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New indexes
CREATE INDEX "quest_entries_quest_id_completed_at_idx"
    ON "quest_entries"("quest_id", "completed_at");
CREATE INDEX "quest_entries_user_id_completed_at_idx"
    ON "quest_entries"("user_id", "completed_at" DESC);
