import { Router } from 'express';
import { LoginSchema, RegisterSchema, UpdateMeSchema } from '@questlog/shared';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireTrustedOrigin } from '../middleware/origin.middleware';
import type { AuthRateLimiters } from '../middleware/rate-limit.middleware';
import * as authController from '../controllers/auth.controller';

export function createAuthRouter(limits: AuthRateLimiters) {
  const router = Router();

  router.post('/register', limits.registerByIp, validate(RegisterSchema), authController.register);
  router.post(
    '/login',
    limits.loginByIp,
    validate(LoginSchema),
    limits.loginByEmail,
    authController.login,
  );
  // Cookie-authenticated: the refresh token never touches JavaScript
  router.post('/refresh', limits.refreshByIp, requireTrustedOrigin, authController.refresh);
  router.post('/logout', requireTrustedOrigin, authController.logout);
  router.post('/logout-all', authMiddleware, authController.logoutAll);
  router.get('/me', authMiddleware, authController.getMe);
  router.patch('/me', authMiddleware, validate(UpdateMeSchema), authController.updateMe);

  return router;
}
