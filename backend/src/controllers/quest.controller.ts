import { Request, Response, NextFunction } from 'express';
import * as questService from '../services/quest.service';
import {
  ListQuestsQuerySchema,
  type CreateQuestBody,
  type UpdateQuestBody,
} from '../validators/quest.validators';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListQuestsQuerySchema.parse(req.query);
    const quests = await questService.listQuests(req.user!.id, query);
    res.json({ quests });
  } catch (err) {
    next(err);
  }
};

export const create = async (
  req: Request<object, object, CreateQuestBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quest = await questService.createQuest(req.user!.id, req.body);
    res.status(201).json({ quest });
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
    const quest = await questService.getQuestById(req.params.id, req.user!.id);
    res.json({ quest });
  } catch (err) {
    next(err);
  }
};

export const update = async (
  req: Request<{ id: string }, object, UpdateQuestBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quest = await questService.updateQuest(req.params.id, req.user!.id, req.body);
    res.json({ quest });
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
    await questService.deleteQuest(req.params.id, req.user!.id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

export const archive = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quest = await questService.archiveQuest(req.params.id, req.user!.id);
    res.json({ quest });
  } catch (err) {
    next(err);
  }
};

export const unarchive = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quest = await questService.unarchiveQuest(req.params.id, req.user!.id);
    res.json({ quest });
  } catch (err) {
    next(err);
  }
};
