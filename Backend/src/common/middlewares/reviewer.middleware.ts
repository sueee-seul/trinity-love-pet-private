import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { parse } from 'cookie';
import {
  REVIEWER_COOKIE_NAME,
  verifyReviewerSessionToken,
} from '../../services/reviewer.session.js';

const sendUnauthorized = (res: Response): void => {
  res.status(401).json({
    error: { code: 'UNAUTHENTICATED', message: 'Reviewer authentication required' },
  });
};

export const requireReviewer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const cookies = parse(req.headers.cookie ?? '');
    const token = cookies[REVIEWER_COOKIE_NAME];
    if (!token) {
      sendUnauthorized(res);
      return;
    }

    const claims = await verifyReviewerSessionToken(token);
    req.reviewer = {
      id: claims.sub,
      displayName: claims.displayName,
      avatarUrl: claims.avatarUrl,
    };
    next();
  } catch {
    sendUnauthorized(res);
  }
};

/**
 * Attaches the reviewer to the request when a valid session cookie is present.
 *
 * Unlike {@link requireReviewer} this never rejects: it is for public endpoints that stay
 * readable while signed out but return extra per-viewer state once a reviewer is known.
 * Downstream handlers must therefore treat the request reviewer as optional.
 */
export const attachReviewerIfPresent = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const cookies = parse(req.headers.cookie ?? '');
    const token = cookies[REVIEWER_COOKIE_NAME];
    if (token) {
      const claims = await verifyReviewerSessionToken(token);
      req.reviewer = {
        id: claims.sub,
        displayName: claims.displayName,
        avatarUrl: claims.avatarUrl,
      };
    }
  } catch {
    // An expired or tampered cookie is treated as signed out rather than as an error,
    // so a stale session never blocks the public review page from loading.
  }

  next();
};

export const requireReviewSimulatorSecret = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const configuredSecret = process.env.REVIEW_SIMULATOR_SECRET;
  const suppliedSecret = req.get('X-Review-Simulator-Secret');

  if (!configuredSecret || !suppliedSecret) {
    sendUnauthorized(res);
    return;
  }

  const configuredBytes = Buffer.from(configuredSecret);
  const suppliedBytes = Buffer.from(suppliedSecret);
  if (
    configuredBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(configuredBytes, suppliedBytes)
  ) {
    sendUnauthorized(res);
    return;
  }

  next();
};
