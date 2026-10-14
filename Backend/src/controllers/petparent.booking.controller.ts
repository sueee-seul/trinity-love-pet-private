import type { Request, Response, NextFunction } from 'express';
import * as Service from '../services/petparent.booking.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { listMyStays } from '../services/petparent.stays-with-card.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

export const getPets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = requireUser(req);
    const data = await Service.getPetsForOwner(user.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getServices = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await Service.getServiceCatalog();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const data = await listMyStays(user.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
