import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  refuseStayChangeSchema,
  staffRescheduleSchema,
  stayChangeListQuerySchema,
} from '../contracts/booking.change.contract.js';
import {
  exceptionCancelSchema,
  recordArrivalSchema,
  type CheckInOutcome,
} from '../contracts/booking.check-in.contract.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as bookingCheckIn from '../services/booking.check-in.js';
import * as managerBookingService from '../services/manager.booking.js';
import * as stayChangeRequests from '../services/stay-change-requests.js';

export const getAllBookings = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await managerBookingService.getAllBookings());
  } catch (error) {
    next(error);
  }
};

/**
 * The signed-in manager who makes a decision. requireManager has already checked the session, so
 * a missing user here is a wiring fault, answered as unauthenticated rather than recorded blank.
 */
const deciderId = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  return req.user.id;
};

// 204 with no body: there's nothing new for the caller to read back beyond
// success, and the list view re-fetches to see the updated status.
export const approveBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingPetsUuid = z.string().uuid().parse(req.params.id);
    await managerBookingService.approveBooking(bookingPetsUuid, deciderId(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// A refusal without a reason is not useful to the pet parent, so it's
// required and non-empty rather than an optional free-text field.
const refuseBookingSchema = z.object({
  reason: z.string().trim().min(1, 'A refusal reason is required'),
});

export const refuseBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingPetsUuid = z.string().uuid().parse(req.params.id);
    const { reason } = refuseBookingSchema.parse(req.body);
    await managerBookingService.refuseBooking(bookingPetsUuid, deciderId(req), reason);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const undoBookingReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingPetsUuid = z.string().uuid().parse(req.params.id);
    await managerBookingService.undoBookingReview(bookingPetsUuid);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/** Only a manager may turn a pet away at the desk: it releases the pet's price with no fee. */
const TURNED_AWAY: CheckInOutcome = 'wagstay_unable';

/**
 * How one pet's arrival went: checked in, no-show, or Wagstay could not take it. Any employee
 * records the first two; turning a pet away is a manager's decision.
 */
export const recordArrival = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingPetsUuid = z.string().uuid().parse(req.params.id);
    const { outcome } = recordArrivalSchema.parse(req.body);
    if (outcome === TURNED_AWAY && req.user?.employee_role !== 'manager') {
      throw new AppError('Only a manager can turn a pet away.', 'FORBIDDEN', 403);
    }
    await bookingCheckIn.recordArrival(bookingPetsUuid, outcome);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/** Charges what the booking's recorded arrivals cost, once, and releases the rest of the hold. */
export const finishCheckIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingId = z.string().uuid().parse(req.params.bookingId);
    res.status(200).json(await bookingCheckIn.finishCheckIn(bookingId));
  } catch (error) {
    next(error);
  }
};

/** Moves a stay without a charge, for an emergency, a red warning or a sick pet. */
export const rescheduleWithoutCharge = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingId = z.string().uuid().parse(req.params.bookingId);
    const { reason, ...dates } = staffRescheduleSchema.parse(req.body);
    res
      .status(200)
      .json(await managerBookingService.rescheduleForException(bookingId, dates, reason));
  } catch (error) {
    next(error);
  }
};

/** Cancels a whole booking without a fee, for an emergency, a red warning or a sick pet. */
export const cancelWithoutFee = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bookingId = z.string().uuid().parse(req.params.bookingId);
    const { reason } = exceptionCancelSchema.parse(req.body);
    await bookingCheckIn.cancelWithoutFee(bookingId, reason);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ----- Change requests for stays under way (stay-change-requests.ts) ----------------------------

export const getStayChangeRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status } = stayChangeListQuerySchema.parse(req.query);
    res
      .status(200)
      .json(await stayChangeRequests.listStayChangeRequestsForManagers(status === 'pending'));
  } catch (error) {
    next(error);
  }
};

/** 204: the change is made; the lists are read again to see it. */
export const approveStayChangeRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = z.string().uuid().parse(req.params.requestId);
    await stayChangeRequests.approveStayChangeRequest(requestId, deciderId(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const refuseStayChangeRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = z.string().uuid().parse(req.params.requestId);
    const { reason } = refuseStayChangeSchema.parse(req.body);
    await stayChangeRequests.refuseStayChangeRequest(requestId, deciderId(req), reason);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
