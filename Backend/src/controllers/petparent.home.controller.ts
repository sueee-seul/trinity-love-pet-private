import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as homeService from '../services/petparent.home.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

export const getHome = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json(await homeService.getHome(requireUser(req).id));
  } catch (error) {
    next(error);
  }
};
