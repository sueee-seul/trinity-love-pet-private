import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  notificationPreferencesUpdateSchema,
  type NotificationPreferencesResponse,
} from '../contracts/notification.preferences.contract.js';
import {
  preferencesForOwner,
  updatePreferencesForOwner,
} from '../services/notification-preferences.service.js';

/** A pet parent's own notification preferences; the owner is always the signed-in user. */

const ownerIdOf = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  return req.user.id;
};

export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const response: NotificationPreferencesResponse = await preferencesForOwner(ownerIdOf(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const putNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const update = notificationPreferencesUpdateSchema.parse(req.body);
    const response: NotificationPreferencesResponse = await updatePreferencesForOwner(
      ownerIdOf(req),
      update,
    );
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
