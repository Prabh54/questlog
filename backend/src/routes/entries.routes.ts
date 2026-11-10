import { Router } from 'express';
import { FeedQuerySchema } from '@questlog/shared';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as entryController from '../controllers/entry.controller';

const router = Router();

router.use(authMiddleware);

// 17. GET    /entries          — paginated feed
// 18. GET    /entries/:id      — single entry
// 19. DELETE /entries/:id      — undo (hard delete)
router.get('/', validate(FeedQuerySchema, 'query'), entryController.feed);
router.get('/:id', entryController.getById);
router.delete('/:id', entryController.remove);

export default router;
