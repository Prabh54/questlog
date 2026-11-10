import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query';

/**
 * Validates req.body (default) or req.query against a shared Zod schema.
 * On success the parsed value — with defaults applied and strings coerced —
 * replaces the original, so handlers can trust its type. On failure responds
 * 400 { error: 'VALIDATION_FAILED', fields }.
 */
export const validate =
  (schema: ZodSchema, source: Source = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: 'VALIDATION_FAILED',
        fields: result.error.flatten().fieldErrors,
      });
      return;
    }
    // Express 4: req.query is a plain, writable property
    req[source] = result.data;
    next();
  };
