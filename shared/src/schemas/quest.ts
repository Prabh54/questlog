import { z } from 'zod';

export const QuestStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const QuestDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'LEGENDARY']);
export type QuestDifficulty = z.infer<typeof QuestDifficultySchema>;

export const QuestSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  status: QuestStatusSchema,
  difficulty: QuestDifficultySchema,
  xpReward: z.number().int().nonnegative(),
  dueDate: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  userId: z.string(),
  categoryId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Quest = z.infer<typeof QuestSchema>;

export const CreateQuestSchema = QuestSchema.pick({
  title: true,
  description: true,
  difficulty: true,
  xpReward: true,
  dueDate: true,
  categoryId: true,
});
export type CreateQuestInput = z.infer<typeof CreateQuestSchema>;

export const UpdateQuestSchema = CreateQuestSchema.partial().extend({
  status: QuestStatusSchema.optional(),
});
export type UpdateQuestInput = z.infer<typeof UpdateQuestSchema>;
