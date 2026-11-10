import { z } from 'zod';

// ── Enums (mirror the Prisma enums) ──────────────────────────────────────
export const QuestDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'LEGENDARY']);
export type QuestDifficulty = z.infer<typeof QuestDifficultySchema>;

export const QuestFrequencySchema = z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export type QuestFrequency = z.infer<typeof QuestFrequencySchema>;

export const QuestStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// ── Wire-format primitives ───────────────────────────────────────────────
/** Dates cross the wire as ISO-8601 strings (Date#toJSON). */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Calendar date in the user's timezone, e.g. "2026-11-09". */
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex like #6366f1');

/** Compact category reference embedded in quests, entries and analytics. */
export const CategoryRefSchema = z
  .object({ id: z.string(), name: z.string(), color: z.string() })
  .strict();
export type CategoryRef = z.infer<typeof CategoryRefSchema>;

// ── Error bodies ─────────────────────────────────────────────────────────
export const ErrorResponseSchema = z
  .object({ error: z.string(), message: z.string() })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const ValidationErrorResponseSchema = z
  .object({
    error: z.literal('VALIDATION_FAILED'),
    fields: z.record(z.array(z.string())),
  })
  .strict();
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
