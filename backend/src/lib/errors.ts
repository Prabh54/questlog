export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    // Restore prototype chain for instanceof checks in transpiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Common pre-built errors
export const Errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', 401, 'Authentication required'),
  forbidden: () => new AppError('FORBIDDEN', 403, 'Access denied'),
  notFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', 404, `${resource} not found`),
  conflict: (msg: string) => new AppError('CONFLICT', 409, msg),
  badRequest: (msg: string) => new AppError('BAD_REQUEST', 400, msg),
} as const;
