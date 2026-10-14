import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  addOnSchema,
  changeTimesSchema,
  extendStaySchema,
  extensionQuerySchema,
} from '../contracts/booking.change.contract.js';
import { bookAddOn, listAddOns } from '../services/booking.guest-addon.js';
import { extendStay, previewExtension } from '../services/booking.guest-extend.js';
import { changeStayTimes } from '../services/booking.guest-times.js';

/**
 * A pet parent changing a stay that is under way: more nights, an add-on for a day, or a new time
 * of day. Each is priced by a GET and applied by a POST that carries the
 * amount the parent saw. Every call is scoped to the signed-in owner: another owner's booking
 * answers 404, exactly like one that does not exist.
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
  extendStay(ownerIdOf(req), uuidParam(req.params.bookingId), extendStaySchema.parse(req.body)),
);

export const getAddOns = handle((req) =>
  listAddOns(ownerIdOf(req), uuidParam(req.params.bookingId)),
);

export const postAddOn = handle((req) =>
  bookAddOn(
    ownerIdOf(req),
    uuidParam(req.params.bookingId),
    uuidParam(req.params.bookingPetId),
    addOnSchema.parse(req.body),
  ),
);

export const patchTimes = handle((req) =>
  changeStayTimes(
    ownerIdOf(req),
    uuidParam(req.params.bookingId),
    uuidParam(req.params.bookingPetId),
    changeTimesSchema.parse(req.body),
  ),
);
