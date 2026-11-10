import { Router } from 'express';
import { TimeSeriesQuerySchema } from '@questlog/shared';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.use(authMiddleware);

// 21. GET /analytics/completions?range=7d|30d|90d|365d|all&bucket=day|week
router.get('/completions', validate(TimeSeriesQuerySchema, 'query'), analyticsController.completionTimeSeries);

// 22. GET /analytics/streaks
router.get('/streaks', analyticsController.streakSummary);

// 23. GET /analytics/categories
router.get('/categories', analyticsController.categoryBreakdown);

// 24. GET /analytics/xp?range=...&bucket=...
router.get('/xp', validate(TimeSeriesQuerySchema, 'query'), analyticsController.xpTimeSeries);

export default router;
