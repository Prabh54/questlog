import { Request, Response, NextFunction } from 'express';
import * as entryService from '../services/entry.service';
import {
  FeedQuerySchema,
  type CompleteQuestBody,
} from '../validators/entry.validators';

export const complete = async (
  req: Request<{ id: string }, object, CompleteQuestBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const entry = await entryService.completeQuest(req.params.id, req.user!.id, req.body);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
};

export const feed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = FeedQuerySchema.parse(req.query);
    const result = await entryService.getEntryFeed(req.user!.id, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const entry = await entryService.getEntryById(req.params.id, req.user!.id);
    res.json({ entry });
  } catch (err) {
    next(err);
  }
};

export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    await entryService.deleteEntry(req.params.id, req.user!.id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};
