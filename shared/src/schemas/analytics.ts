import { z } from 'zod';
import {
  CategoryRefSchema,
  LocalDateSchema,
  QuestDifficultySchema,
  QuestFrequencySchema,
} from './common';

// ── Requests ─────────────────────────────────────────────────────────────
export const RangeSchema = z.enum(['7d', '30d', '90d', '365d', 'all']);
export type Range = z.infer<typeof RangeSchema>;

export const BucketSchema = z.enum(['day', 'week']);
export type Bucket = z.infer<typeof BucketSchema>;

export const TimeSeriesQuerySchema = z.object({
  range: RangeSchema.default('30d'),
  bucket: BucketSchema.default('day'),
});
export type TimeSeriesQuery = z.infer<typeof TimeSeriesQuerySchema>;

// ── Responses ────────────────────────────────────────────────────────────
export const TodayQuestSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    difficulty: QuestDifficultySchema,
    xp_reward: z.number().int(),
    category: CategoryRefSchema.nullable(),
    completedToday: z.boolean(),
  })
  .strict();
export type TodayQuest = z.infer<typeof TodayQuestSchema>;

export const DashboardSummarySchema = z
  .object({
    totalXp: z.number().int().nonnegative(),
    level: z.number().int().positive(),
    xpInLevel: z.number().int().nonnegative(),
    xpToNext: z.number().int().nonnegative(),
    xpProgress: z.number().min(0).max(1),
    todayCompletionPct: z.number().min(0).max(100),
    activeQuestCount: z.number().int().nonnegative(),
    bestStreak: z.number().int().nonnegative(),
    todayQuests: z.array(TodayQuestSchema),
  })
  .strict();
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

/** `date` is a local day, or the Monday of the ISO week for bucket=week. */
export const TimeSeriesPointSchema = z
  .object({ date: LocalDateSchema, count: z.number().int().nonnegative() })
  .strict();
export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;

export const CompletionsResponseSchema = z
  .object({ range: RangeSchema, bucket: BucketSchema, series: z.array(TimeSeriesPointSchema) })
  .strict();
export type CompletionsResponse = z.infer<typeof CompletionsResponseSchema>;

export const PerQuestStreakSchema = z
  .object({
    questId: z.string(),
    questTitle: z.string(),
    difficulty: QuestDifficultySchema,
    frequency: QuestFrequencySchema,
    category: CategoryRefSchema.nullable(),
    current: z.number().int().nonnegative(),
    longest: z.number().int().nonnegative(),
    totalCompletions: z.number().int().nonnegative(),
  })
  .strict();
export type PerQuestStreak = z.infer<typeof PerQuestStreakSchema>;

export const StreakSummarySchema = z
  .object({
    quests: z.array(PerQuestStreakSchema),
    best: z
      .object({
        current: z.number().int().nonnegative(),
        longest: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type StreakSummary = z.infer<typeof StreakSummarySchema>;

export const CategoryBreakdownRowSchema = z
  .object({
    categoryId: z.string().nullable(),
    name: z.string(),
    color: z.string(),
    completions: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
    pctOfTotal: z.number().min(0).max(100),
  })
  .strict();
export type CategoryBreakdownRow = z.infer<typeof CategoryBreakdownRowSchema>;

export const CategoryBreakdownSchema = z
  .object({
    categories: z.array(CategoryBreakdownRowSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type CategoryBreakdown = z.infer<typeof CategoryBreakdownSchema>;

export const XpTimeSeriesPointSchema = z
  .object({
    date: LocalDateSchema,
    xp: z.number().int().nonnegative(),
    cumulativeXp: z.number().int().nonnegative(),
    level: z.number().int().positive(),
  })
  .strict();
export type XpTimeSeriesPoint = z.infer<typeof XpTimeSeriesPointSchema>;

export const XpTimeSeriesResponseSchema = z
  .object({ range: RangeSchema, bucket: BucketSchema, series: z.array(XpTimeSeriesPointSchema) })
  .strict();
export type XpTimeSeriesResponse = z.infer<typeof XpTimeSeriesResponseSchema>;
