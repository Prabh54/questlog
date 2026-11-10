import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  // Safety net: a schema parsed outside validate() is still a client error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      fields: err.flatten().fieldErrors,
    });
    return;
  }

  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
};
