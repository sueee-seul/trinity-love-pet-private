import type { Request, Response, NextFunction } from 'express';
import * as Service from '../services/petparent.stays.js';
import { AppError } from '../common/middlewares/error.middleware.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

export const getStays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = requireUser(req);
    const stays = await Service.getStaysForOwner(user.id);
    res.status(200).json({ stays });
  } catch (error) {
    next(error);
  }
};
