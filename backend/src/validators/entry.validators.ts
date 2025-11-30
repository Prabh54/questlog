import { z } from 'zod';

export const CompleteQuestSchema = z.object({
  note: z.string().max(1000, 'Note must be at most 1000 characters').optional(),
});
export type CompleteQuestBody = z.infer<typeof CompleteQuestSchema>;

export const FeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  quest_id: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type FeedQuery = z.infer<typeof FeedQuerySchema>;
