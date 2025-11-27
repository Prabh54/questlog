import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  CreateQuestSchema,
  UpdateQuestSchema,
} from '../validators/quest.validators';
import { CompleteQuestSchema } from '../validators/entry.validators';
import * as questController from '../controllers/quest.controller';
import * as entryController from '../controllers/entry.controller';

const router = Router();

router.use(authMiddleware);

// 9.  GET    /quests              — list with filters
// 10. POST   /quests              — create
// 11. GET    /quests/:id          — read
// 12. PATCH  /quests/:id          — update
// 13. DELETE /quests/:id          — delete
// 14. POST   /quests/:id/archive  — archive
// 15. POST   /quests/:id/unarchive — unarchive
// 16. POST   /quests/:id/complete  — log a completion entry

router.get('/', questController.list);
router.post('/', validate(CreateQuestSchema), questController.create);
router.get('/:id', questController.getById);
router.patch('/:id', validate(UpdateQuestSchema), questController.update);
router.delete('/:id', questController.remove);
router.post('/:id/archive', questController.archive);
router.post('/:id/unarchive', questController.unarchive);
router.post('/:id/complete', validate(CompleteQuestSchema), entryController.complete);

export default router;
