import { z } from 'zod';
import { IsoDateTimeSchema, UserRoleSchema } from './common';

// ── Field rules (reused by forms on the client) ──────────────────────────
export const DisplayNameSchema = z
  .string()
  .min(3, 'At least 3 characters')
  .max(30, 'At most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only');

export const EmailSchema = z.string().email('Enter a valid email');

export const PasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters')
  .regex(/[a-zA-Z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number');

export function isValidTimeZone(tz: string): boolean {
  try {
    // Throws RangeError for unknown IANA zones
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const TimezoneSchema = z
  .string()
  .min(1, 'Pick a timezone')
  .max(64)
  .refine(isValidTimeZone, { message: 'Invalid IANA timezone' });

// ── Requests ─────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  display_name: DisplayNameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterBody = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginBody = z.infer<typeof LoginSchema>;

export const UpdateMeSchema = z
  .object({
    display_name: DisplayNameSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateMeBody = z.infer<typeof UpdateMeSchema>;

// ── Responses ────────────────────────────────────────────────────────────
export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
    role: UserRoleSchema,
    xp: z.number().int().nonnegative(),
    level: z.number().int().positive(),
    xpToNext: z.number().int().nonnegative(),
    progress: z.number().min(0).max(1),
    timezone: z.string(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({ token: z.string(), user: UserSchema }).strict();
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const UserResponseSchema = z.object({ user: UserSchema }).strict();
export type UserResponse = z.infer<typeof UserResponseSchema>;
