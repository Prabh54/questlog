import { Request, Response, NextFunction } from 'express';
import { Errors } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

/**
 * Requires `Authorization: Bearer <access token>`. Access tokens are
 * stateless and live 15 minutes; revocation takes effect when the client next
 * tries to refresh. That window is the trade-off for not hitting the database
 * on every request.
 */
export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(Errors.unauthorized());
    return;
  }

  try {
    const { userId, email, sessionId } = verifyAccessToken(authHeader.slice(7));
    req.user = { id: userId, email, sessionId };
    next();
  } catch {
    next(Errors.unauthorized());
  }
};
