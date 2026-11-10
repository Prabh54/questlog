import { z } from 'zod';
import { CategorySchema } from './category';
import {
  IsoDateTimeSchema,
  LocalDateSchema,
  QuestDifficultySchema,
  QuestFrequencySchema,
  QuestStatusSchema,
} from './common';

export const QUEST_TITLE_MAX = 200;
export const QUEST_DESCRIPTION_MAX = 2000;
export const XP_REWARD_MIN = 5;
export const XP_REWARD_MAX = 100;

export const QuestTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(QUEST_TITLE_MAX, `At most ${QUEST_TITLE_MAX} characters`);

export const XpRewardSchema = z
  .number()
  .int()
  .min(XP_REWARD_MIN, `Minimum ${XP_REWARD_MIN} XP`)
  .max(XP_REWARD_MAX, `Maximum ${XP_REWARD_MAX} XP`);

// ── Requests ─────────────────────────────────────────────────────────────
export const CreateQuestSchema = z.object({
  title: QuestTitleSchema,
  description: z.string().max(QUEST_DESCRIPTION_MAX).nullish(),
  difficulty: QuestDifficultySchema.default('MEDIUM'),
  frequency: QuestFrequencySchema.default('DAILY'),
  xp_reward: XpRewardSchema.default(10),
  category_id: z.string().nullish(),
  is_active: z.boolean().default(true),
});
export type CreateQuestBody = z.infer<typeof CreateQuestSchema>;
/** What a client may send (defaulted fields are optional). */
export type CreateQuestInput = z.input<typeof CreateQuestSchema>;

export const UpdateQuestSchema = CreateQuestSchema.partial();
export type UpdateQuestBody = z.infer<typeof UpdateQuestSchema>;
export type UpdateQuestInput = z.input<typeof UpdateQuestSchema>;

export const QuestSortSchema = z.enum(['newest', 'oldest', 'xp_desc', 'xp_asc', 'title']);
export type QuestSort = z.infer<typeof QuestSortSchema>;

export const ListQuestsQuerySchema = z.object({
  search: z.string().optional(),
  category_id: z.string().optional(),
  difficulty: QuestDifficultySchema.optional(),
  frequency: QuestFrequencySchema.optional(),
  status: QuestStatusSchema.optional(),
  sort: QuestSortSchema.default('newest'),
});
export type ListQuestsQuery = z.infer<typeof ListQuestsQuerySchema>;
export type ListQuestsQueryInput = z.input<typeof ListQuestsQuerySchema>;

// ── Responses ────────────────────────────────────────────────────────────
export const StripDaySchema = z.object({ date: LocalDateSchema, completed: z.boolean() }).strict();
export type StripDay = z.infer<typeof StripDaySchema>;

export const QuestSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: QuestStatusSchema,
    difficulty: QuestDifficultySchema,
    frequency: QuestFrequencySchema,
    xp_reward: z.number().int(),
    is_active: z.boolean(),
    due_date: IsoDateTimeSchema.nullable(),
    completed_at: IsoDateTimeSchema.nullable(),
    category: CategorySchema.nullable(),
    streak: z.number().int().nonnegative(),
    longest_streak: z.number().int().nonnegative(),
    total_completions: z.number().int().nonnegative(),
    /** Last 14 local days, oldest first. */
    strip: z.array(StripDaySchema),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .strict();
export type Quest = z.infer<typeof QuestSchema>;

export const QuestResponseSchema = z.object({ quest: QuestSchema }).strict();
export const QuestListResponseSchema = z.object({ quests: z.array(QuestSchema) }).strict();
export type QuestResponse = z.infer<typeof QuestResponseSchema>;
export type QuestListResponse = z.infer<typeof QuestListResponseSchema>;
