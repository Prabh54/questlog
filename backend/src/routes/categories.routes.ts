import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from '../validators/category.validators';
import * as categoryController from '../controllers/category.controller';

const router = Router();

// All category routes require auth
router.use(authMiddleware);

// 5. GET /categories
router.get('/', categoryController.list);

// 6. POST /categories
router.post('/', validate(CreateCategorySchema), categoryController.create);

// 7. PATCH /categories/:id
router.patch('/:id', validate(UpdateCategorySchema), categoryController.update);

// 8. DELETE /categories/:id
router.delete('/:id', categoryController.remove);

export default router;
