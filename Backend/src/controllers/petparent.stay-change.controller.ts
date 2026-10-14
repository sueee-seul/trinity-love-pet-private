import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  cancelStaySchema,
  newDatesSchema,
  rescheduleStaySchema,
} from '../contracts/booking.change.contract.js';
import { cancelByGuest, previewCancellation } from '../services/booking.guest-change.js';
import { previewReschedule, rescheduleByGuest } from '../services/booking.guest-reschedule.js';

/**
 * A pet parent cancelling or moving their own stay from My stays. Each call is scoped to the
 * signed-in owner: another owner's booking answers 404, exactly like one that does not exist.
 */

const ownerIdOf = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  return req.user.id;
};

const bookingIdOf = (req: Request): string => z.string().uuid().parse(req.params.bookingId);

export const getCancellation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await previewCancellation(ownerIdOf(req), bookingIdOf(req)));
  } catch (error) {
    next(error);
  }
};

export const cancelStay = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // An empty body cancels at whatever the fee is now; a previewed fee must still match.
    const input = cancelStaySchema.parse(req.body ?? {});
    res.status(200).json(await cancelByGuest(ownerIdOf(req), bookingIdOf(req), input));
  } catch (error) {
    next(error);
  }
};

/** GET with ?startDate=&endDate=: what moving would cost, before the guest commits. */
export const getReschedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const dates = newDatesSchema.parse(req.query);
    res.status(200).json(await previewReschedule(ownerIdOf(req), bookingIdOf(req), dates));
  } catch (error) {
    next(error);
  }
};

export const rescheduleStay = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = rescheduleStaySchema.parse(req.body);
    res.status(200).json(await rescheduleByGuest(ownerIdOf(req), bookingIdOf(req), input));
  } catch (error) {
    next(error);
  }
};
