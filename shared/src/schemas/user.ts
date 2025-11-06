import { z } from 'zod';

export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  role: UserRoleSchema,
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;
