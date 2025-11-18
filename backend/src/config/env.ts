import { z } from 'zod';
import { config } from 'dotenv';

config();

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgresql://', { message: 'DATABASE_URL must be a postgresql:// URL' }),

  JWT_SECRET: z
    .string()
    .min(32, { message: 'JWT_SECRET must be at least 32 characters' }),

  PORT: z
    .string()
    .default('3001')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim())),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌  Invalid environment variables:\n');
  for (const [field, errors] of Object.entries(result.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${(errors as string[]).join(', ')}`);
  }
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
