import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as analytics from '../services/analytics.service';

const RangeSchema = z.enum(['7d', '30d', '90d', '365d', 'all']).default('30d');
const BucketSchema = z.enum(['day', 'week']).default('day');

const TimeSeriesQuerySchema = z.object({
  range: RangeSchema,
  bucket: BucketSchema,
});

export const dashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await analytics.getDashboardSummary(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const completionTimeSeries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { range, bucket } = TimeSeriesQuerySchema.parse(req.query);
    res.json(await analytics.getCompletionTimeSeries(req.user!.id, range, bucket));
  } catch (err) {
    next(err);
  }
};

export const streakSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await analytics.getStreakSummary(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const categoryBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.json(await analytics.getCategoryBreakdown(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const xpTimeSeries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { range, bucket } = TimeSeriesQuerySchema.parse(req.query);
    res.json(await analytics.getXpTimeSeries(req.user!.id, range, bucket));
  } catch (err) {
    next(err);
  }
};
