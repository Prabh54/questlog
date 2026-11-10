-- Covering index for the per-user aggregates (src/services/stats.queries.ts).
-- Same leading key as before, so the feed's keyset pagination still uses it;
-- quest_id and xp_earned are added as trailing key columns (Prisma's schema
-- can't express INCLUDE) so streaks, time series, category totals and the XP
-- sum are answered by index-only scans with no heap fetches.
DROP INDEX "quest_entries_user_id_completed_at_idx";
CREATE INDEX "quest_entries_user_id_completed_at_quest_id_xp_earned_idx"
    ON "quest_entries" ("user_id", "completed_at" DESC, "quest_id", "xp_earned");
