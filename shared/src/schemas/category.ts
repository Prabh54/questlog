import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = CategorySchema.pick({
  name: true,
  description: true,
  color: true,
  icon: true,
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
