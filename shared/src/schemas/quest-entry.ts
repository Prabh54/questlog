import { z } from 'zod';

export const EntryStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']);
export type EntryStatus = z.infer<typeof EntryStatusSchema>;

export const QuestEntrySchema = z.object({
  id: z.string(),
  questId: z.string(),
  status: EntryStatusSchema,
  notes: z.string().max(1000).nullable(),
  date: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type QuestEntry = z.infer<typeof QuestEntrySchema>;

export const CreateQuestEntrySchema = QuestEntrySchema.pick({
  status: true,
  notes: true,
  date: true,
});
export type CreateQuestEntryInput = z.infer<typeof CreateQuestEntrySchema>;

export const UpdateQuestEntrySchema = CreateQuestEntrySchema.partial();
export type UpdateQuestEntryInput = z.infer<typeof UpdateQuestEntrySchema>;
