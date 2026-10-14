import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  getManagerGoogleReviewNotifications as loadManagerGoogleReviewNotifications,
  markManagerGoogleReviewNotificationAsRead,
  parseGoogleReviewNotificationQuery,
  readAllManagerGoogleReviewNotifications as readAllManagerGoogleReviewNotificationsService,
} from '../services/admin.google.review.notification.service.js';

const notificationUuidSchema = z.string().uuid('Notification UUID must be a valid UUID');

const getManagerUuid = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user.id;
};

export const getManagerGoogleReviewNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const query = parseGoogleReviewNotificationQuery(req.query);
    const data = await loadManagerGoogleReviewNotifications(getManagerUuid(req), query);
    res.status(200).json({ code: 200, msg: 'Google review notifications loaded', data });
  } catch (error: unknown) {
    next(error);
  }
};

export const markManagerGoogleReviewNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const notificationUuid = notificationUuidSchema.parse(req.params.id);
    const data = await markManagerGoogleReviewNotificationAsRead(
      notificationUuid,
      getManagerUuid(req),
    );
    res.status(200).json({ code: 200, msg: 'Google review notification read', data });
  } catch (error: unknown) {
    next(error);
  }
};

export const readAllManagerGoogleReviewNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await readAllManagerGoogleReviewNotificationsService(getManagerUuid(req));
    res.status(200).json({ code: 200, msg: 'Google review notifications read', data });
  } catch (error: unknown) {
    next(error);
  }
};
