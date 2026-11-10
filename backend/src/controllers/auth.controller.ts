import { Request, Response, NextFunction } from 'express';
import type { LoginBody, RegisterBody, UpdateMeBody } from '@questlog/shared';
import * as authService from '../services/auth.service';
import { revokeAllSessions, revokeSessionByToken } from '../services/session.service';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../lib/auth-cookie';
import { AppError } from '../lib/errors';

function sendAuth(res: Response, status: number, result: authService.AuthResult) {
  setRefreshCookie(res, result.refresh.refreshToken, result.refresh.refreshExpiresAt);
  res.status(status).json(result.body);
}

export const register = async (
  req: Request<object, object, RegisterBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendAuth(res, 201, await authService.register(req.body, req.get('user-agent')));
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request<object, object, LoginBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendAuth(res, 200, await authService.login(req.body, req.get('user-agent')));
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  const presented = readRefreshCookie(req);
  try {
    if (!presented) {
      throw new AppError('INVALID_REFRESH_TOKEN', 401, 'Session expired. Please log in again.');
    }
    sendAuth(res, 200, await authService.refresh(presented));
  } catch (err) {
    // A dead refresh cookie is useless to the browser; drop it
    if (err instanceof AppError && err.status === 401) clearRefreshCookie(res);
    next(err);
  }
};

/** Ends this device's session. Works with an expired access token, and is idempotent. */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presented = readRefreshCookie(req);
    if (presented) await revokeSessionByToken(presented);
    clearRefreshCookie(res);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

/** Ends every session of the user, on every device. */
export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeAllSessions(req.user!.id);
    clearRefreshCookie(res);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await authService.getMe(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (
  req: Request<object, object, UpdateMeBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await authService.updateMe(req.user!.id, req.body));
  } catch (err) {
    next(err);
  }
};
