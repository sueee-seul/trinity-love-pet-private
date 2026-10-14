import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  parentNotificationListQuerySchema,
  parentNotificationsReadAllSchema,
} from '../contracts/booking.notification.contract.js';
import * as notificationService from '../services/petparent.notifications.js';

// The owner always comes from the session, never from the request, so a parent can only ever
// read or mark their own notices.

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

const notificationParamsSchema = z.object({ id: z.uuid() });

export const listNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const query = parentNotificationListQuerySchema.parse(req.query);
    res
      .status(200)
      .json(await notificationService.getParentNotifications(requireUser(req).id, query));
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = notificationParamsSchema.parse(req.params);
    res.status(200).json(await notificationService.readParentNotification(requireUser(req).id, id));
  } catch (error) {
    next(error);
  }
};

export const readAllNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = parentNotificationsReadAllSchema.parse(req.body ?? {});
    res
      .status(200)
      .json(await notificationService.readAllParentNotifications(requireUser(req).id, input));
  } catch (error) {
    next(error);
  }
};
