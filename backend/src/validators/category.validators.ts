import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex like #6366f1');

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(200).nullish(),
  color: hexColor.default('#6366f1'),
  icon: z.string().max(50).nullish(),
});
export type CreateCategoryBody = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryBody = z.infer<typeof UpdateCategorySchema>;
