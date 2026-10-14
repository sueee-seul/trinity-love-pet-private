import type { NextFunction, Request, Response } from 'express';
import { adminGoogleReviewQuerySchema } from '../contracts/google.review.admin.contract.js';
import { reviewPageQuerySchema } from '../contracts/review.contract.js';
import {
  GOOGLE_REVIEW_UPDATED_EVENT,
  subscribeToGoogleReviewEvents,
  type GoogleReviewEventTarget,
  type GoogleReviewInvalidationEvent,
} from '../services/google.review.events.js';

/**
 * Heartbeat interval for Google Review SSE.
 */
export const GOOGLE_REVIEW_SSE_HEARTBEAT_INTERVAL_MS = 25_000;

const formatEvent = (event: GoogleReviewInvalidationEvent): string =>
  `event: ${GOOGLE_REVIEW_UPDATED_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;

const writeHeartbeat = (res: Response): void => {
  res.write(': heartbeat\n\n');
};

const streamGoogleReviewEvents = (
  req: Request,
  res: Response,
  next: NextFunction,
  target: GoogleReviewEventTarget,
  querySchema: typeof adminGoogleReviewQuerySchema,
): void => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  let closed = false;
  let unsubscribe: () => void = () => undefined;

  const cleanup = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    unsubscribe();
  };

  const writeEvent = (event: GoogleReviewInvalidationEvent): void => {
    if (closed || res.writableEnded) {
      cleanup();
      return;
    }

    try {
      res.write(formatEvent(event));
    } catch {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  };

  unsubscribe = subscribeToGoogleReviewEvents(target, parsed.data.placeSlug, writeEvent);
  req.once('close', cleanup);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded) {
      cleanup();
      return;
    }

    try {
      writeHeartbeat(res);
    } catch {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  }, GOOGLE_REVIEW_SSE_HEARTBEAT_INTERVAL_MS);
};

/**
 * Streams real-time Google Review updates for the admin dashboard.
 *
 * @remarks
 * Applies the 'admin' boundary and ensures data is only streamed to authorized employees.
 */
export const streamAdminGoogleReviewEvents = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  streamGoogleReviewEvents(req, res, next, 'admin', adminGoogleReviewQuerySchema);
};

/**
 * Streams public real-time Google Review updates.
 *
 * @remarks
 * Uses the 'public' target scope, omitting restricted internal data.
 */
export const streamPublicGoogleReviewEvents = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  streamGoogleReviewEvents(req, res, next, 'public', reviewPageQuerySchema);
};
