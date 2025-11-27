import { z } from 'zod';

export const QuestDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'LEGENDARY']);
export const QuestFrequencySchema = z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export const QuestStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);

export const CreateQuestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).nullish(),
  difficulty: QuestDifficultySchema.default('MEDIUM'),
  frequency: QuestFrequencySchema.default('DAILY'),
  xp_reward: z
    .number()
    .int()
    .min(5, 'Minimum 5 XP')
    .max(100, 'Maximum 100 XP')
    .default(10),
  category_id: z.string().nullish(),
  is_active: z.boolean().default(true),
});
export type CreateQuestBody = z.infer<typeof CreateQuestSchema>;

export const UpdateQuestSchema = CreateQuestSchema.partial();
export type UpdateQuestBody = z.infer<typeof UpdateQuestSchema>;

// ── Query filters for GET /quests ─────────────────────────────────────────
export const ListQuestsQuerySchema = z.object({
  search: z.string().optional(),
  category_id: z.string().optional(),
  difficulty: QuestDifficultySchema.optional(),
  frequency: QuestFrequencySchema.optional(),
  status: QuestStatusSchema.optional(),
  sort: z
    .enum(['newest', 'oldest', 'xp_desc', 'xp_asc', 'title'])
    .default('newest'),
});
export type ListQuestsQuery = z.infer<typeof ListQuestsQuerySchema>;
