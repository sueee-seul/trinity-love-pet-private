import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  addOnSchema,
  changeTimesSchema,
  extendStaySchema,
  extensionQuerySchema,
} from '../contracts/booking.change.contract.js';
import { listAddOns } from '../services/booking.guest-addon.js';
import { previewExtension } from '../services/booking.guest-extend.js';
import {
  listMyStayChangeRequests,
  requestAddOn,
  requestExtension,
  requestTimes,
  withdrawStayChangeRequest,
} from '../services/stay-change-requests.js';

/**
 * A pet parent asking to change a stay that is under way: more nights, an add-on for a day, or a
 * new time of day. Each is priced by a GET; the POST (or PATCH) carries the amount the parent saw
 * and saves a request for a manager to approve (stay-change-requests.ts). Nothing changes until
 * then. Every call is scoped to the signed-in owner: another owner's booking answers 404, exactly
 * like one that does not exist.
 */

const ownerIdOf = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  return req.user.id;
};

const uuidParam = (value: unknown): string => z.string().uuid().parse(value);

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/** Every handler here is "parse, call one service, send"; the error handler does the rest. */
const handle =
  (run: (req: Request) => Promise<unknown>): Handler =>
  async (req, res, next) => {
    try {
      res.status(200).json(await run(req));
    } catch (error) {
      next(error);
    }
  };

export const getExtension = handle((req) => {
  const { endDate } = extensionQuerySchema.parse(req.query);
  return previewExtension(ownerIdOf(req), uuidParam(req.params.bookingId), endDate);
});

export const postExtension = handle((req) =>
  requestExtension(
    ownerIdOf(req),
    uuidParam(req.params.bookingId),
    extendStaySchema.parse(req.body),
  ),
);

export const getAddOns = handle((req) =>
  listAddOns(ownerIdOf(req), uuidParam(req.params.bookingId)),
);

export const postAddOn = handle((req) =>
  requestAddOn(
    ownerIdOf(req),
    uuidParam(req.params.bookingId),
    uuidParam(req.params.bookingPetId),
    addOnSchema.parse(req.body),
  ),
);

export const patchTimes = handle((req) =>
  requestTimes(
    ownerIdOf(req),
    uuidParam(req.params.bookingId),
    uuidParam(req.params.bookingPetId),
    changeTimesSchema.parse(req.body),
  ),
);

export const getStayChangeRequests = handle((req) => listMyStayChangeRequests(ownerIdOf(req)));

export const postWithdrawStayChangeRequest = handle(async (req) => {
  await withdrawStayChangeRequest(ownerIdOf(req), uuidParam(req.params.requestId));
  return { withdrawn: true };
});
