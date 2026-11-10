import { Request, Response, NextFunction } from 'express';
import type { TimeSeriesQuery } from '@questlog/shared';
import * as analytics from '../services/analytics.service';

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
    const { range, bucket } = req.query as unknown as TimeSeriesQuery; // validated by route
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
    const { range, bucket } = req.query as unknown as TimeSeriesQuery; // validated by route
    res.json(await analytics.getXpTimeSeries(req.user!.id, range, bucket));
  } catch (err) {
    next(err);
  }
};
