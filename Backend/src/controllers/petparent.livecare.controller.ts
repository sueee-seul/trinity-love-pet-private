import type { Request, Response, NextFunction } from 'express';
import * as Service from '../services/petparent.livecare.js';
import { streamTaskEvents } from '../services/livecare.events.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { uuidParam } from './task.controller.helpers.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

const requestedDate = (req: Request): string | undefined => {
  const { date } = req.query;
  return typeof date === 'string' ? date : undefined;
};

/** `?lang=zh` asks for staff notes in Chinese too; anything else is English. */
const requestedLanguage = (req: Request): Service.LiveCareLanguage =>
  req.query.lang === 'zh' ? 'zh' : 'en';

export const getLiveCare = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);

    const { bookingPetId: paramId } = req.params;
    let bookingPetId: string;
    if (paramId === undefined) {
      bookingPetId = await Service.resolveCurrentBookingPetId(user.id);
    } else {
      const validId = uuidParam(paramId);
      if (!validId) {
        throw new AppError('bookingPetId must be a valid UUID', 'VALIDATION_FAILED', 422);
      }
      bookingPetId = validId;
    }

    const data = await Service.getLiveCare(
      user.id,
      bookingPetId,
      requestedDate(req),
      requestedLanguage(req),
    );
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// Live-updates stream for one stay: no task/photo content travels over this
// connection, just a "something changed" ping the client reacts to by
// re-fetching GET .../live-care/:bookingPetId (same pattern as the
// conversation/Google Review SSE streams).
export const streamLiveCare = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const bookingPetId = uuidParam(req.params.bookingPetId);
    if (!bookingPetId) {
      throw new AppError('bookingPetId must be a valid UUID', 'VALIDATION_FAILED', 422);
    }
    const petId = await Service.getStayPetId(user.id, bookingPetId);
    streamTaskEvents(req, res, petId);
  } catch (error) {
    next(error);
  }
};
