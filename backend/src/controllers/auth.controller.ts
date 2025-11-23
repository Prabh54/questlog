import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import type { RegisterBody, LoginBody } from '../validators/auth.validators';
import type { UpdateMeBody } from '../validators/user.validators';

export const register = async (
  req: Request<object, object, RegisterBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request<object, object, LoginBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getMe(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (
  req: Request<object, object, UpdateMeBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.updateMe(req.user!.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  res.sendStatus(204);
};
