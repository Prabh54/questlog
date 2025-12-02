import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.use(authMiddleware);

// 20. GET /dashboard/summary
router.get('/summary', analyticsController.dashboardSummary);

export default router;
