import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { RegisterSchema, LoginSchema } from '../validators/auth.validators';
import { UpdateMeSchema } from '../validators/user.validators';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', validate(RegisterSchema), authController.register);
router.post('/login', validate(LoginSchema), authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.patch('/me', authMiddleware, validate(UpdateMeSchema), authController.updateMe);
router.post('/logout', authMiddleware, authController.logout);

export default router;
