import { z } from 'zod';
import {
  CategoryRefSchema,
  IsoDateTimeSchema,
  QuestDifficultySchema,
  QuestFrequencySchema,
} from './common';

export const NOTE_MAX = 1000;
export const FEED_LIMIT_MAX = 100;

// ── Requests ─────────────────────────────────────────────────────────────
export const CompleteQuestSchema = z.object({
  note: z.string().max(NOTE_MAX, `Note must be at most ${NOTE_MAX} characters`).optional(),
});
export type CompleteQuestBody = z.infer<typeof CompleteQuestSchema>;

export const FeedQuerySchema = z.object({
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(FEED_LIMIT_MAX).default(20),
  quest_id: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type FeedQuery = z.infer<typeof FeedQuerySchema>;
/** Query-string form a client sends (dates as ISO strings). */
export interface FeedQueryInput {
  cursor?: string;
  limit?: number;
  quest_id?: string;
  from?: string;
  to?: string;
}

// ── Responses ────────────────────────────────────────────────────────────
export const EntryQuestSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    difficulty: QuestDifficultySchema,
    frequency: QuestFrequencySchema,
    /** Included by the feed and GET /entries/:id; omitted by POST /complete. */
    category: CategoryRefSchema.nullable().optional(),
  })
  .strict();

export const QuestEntrySchema = z
  .object({
    id: z.string(),
    questId: z.string(),
    userId: z.string(),
    xpEarned: z.number().int(),
    note: z.string().nullable(),
    /** Completion bucket: local start date of the day / ISO week / month, or "ONCE". */
    periodKey: z.string(),
    completedAt: IsoDateTimeSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    quest: EntryQuestSchema,
  })
  .strict();
export type QuestEntry = z.infer<typeof QuestEntrySchema>;

export const EntryResponseSchema = z.object({ entry: QuestEntrySchema }).strict();
export type EntryResponse = z.infer<typeof EntryResponseSchema>;

export const FeedResponseSchema = z
  .object({
    entries: z.array(QuestEntrySchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
