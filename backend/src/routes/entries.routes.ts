import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as entryController from '../controllers/entry.controller';

const router = Router();

router.use(authMiddleware);

// 17. GET    /entries          — paginated feed
// 18. GET    /entries/:id      — single entry
// 19. DELETE /entries/:id      — undo (hard delete)
router.get('/', entryController.feed);
router.get('/:id', entryController.getById);
router.delete('/:id', entryController.remove);

export default router;
