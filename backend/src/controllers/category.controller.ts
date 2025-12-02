import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/category.service';
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from '../validators/category.validators';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.listCategories(req.user!.id);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

export const create = async (
  req: Request<object, object, CreateCategoryBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = await categoryService.createCategory(req.user!.id, req.body);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

export const update = async (
  req: Request<{ id: string }, object, UpdateCategoryBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.user!.id,
      req.body,
    );
    res.json({ category });
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
    await categoryService.deleteCategory(req.params.id, req.user!.id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};
