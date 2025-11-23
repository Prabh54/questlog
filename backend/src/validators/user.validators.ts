import { z } from 'zod';

export const UpdateMeSchema = z
  .object({
    display_name: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only')
      .optional(),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine(
        (tz) => {
          try {
            // Throws RangeError for unknown IANA zones
            new Intl.DateTimeFormat('en-US', { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: 'Invalid IANA timezone' },
      )
      .optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type UpdateMeBody = z.infer<typeof UpdateMeSchema>;
