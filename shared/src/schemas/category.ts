import { z } from 'zod';
import { HexColorSchema, IsoDateTimeSchema } from './common';

export const DEFAULT_CATEGORY_COLOR = '#6366f1';

// ── Requests ─────────────────────────────────────────────────────────────
export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(200).nullish(),
  color: HexColorSchema.default(DEFAULT_CATEGORY_COLOR),
  icon: z.string().max(50).nullish(),
});
export type CreateCategoryBody = z.infer<typeof CreateCategorySchema>;
export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryBody = z.infer<typeof UpdateCategorySchema>;
export type UpdateCategoryInput = z.input<typeof UpdateCategorySchema>;

// ── Responses ────────────────────────────────────────────────────────────
export const CategorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string(),
    icon: z.string().nullable(),
    userId: z.string(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    /** Present on GET /categories only. */
    _count: z.object({ quests: z.number().int().nonnegative() }).strict().optional(),
  })
  .strict();
export type Category = z.infer<typeof CategorySchema>;

export const CategoryResponseSchema = z.object({ category: CategorySchema }).strict();
export const CategoryListResponseSchema = z
  .object({ categories: z.array(CategorySchema) })
  .strict();
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;
