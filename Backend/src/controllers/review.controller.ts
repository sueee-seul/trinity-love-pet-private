import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  reviewPageQuerySchema,
  parseReviewSubmissionPayload,
  simulatorReviewSubmissionSchema,
} from '../contracts/review.contract.js';
import { ReviewService } from '../services/review.service.js';
import { googleReviewLikeReviewIdSchema } from '../contracts/google.review.like.contract.js';

const reviewUuidSchema = z.string().uuid('Review UUID must be a valid UUID');

export const getGoogleReviewPage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = reviewPageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  try {
    // req.reviewer is optional here: the page stays readable while signed out, and the
    // identity only decides whether each review comes back marked as liked by this viewer.
    const reviewPage = await ReviewService.getGoogleReviewPage(
      parsed.data.placeSlug,
      req.reviewer?.id ?? null,
    );
    if (!reviewPage) {
      res.status(404).json({ code: 404, msg: 'Review location not found', data: null });
      return;
    }

    // The payload carries viewerHasLiked, which differs per session. Without this a shared or
    // browser cache could hand one reviewer another reviewer's like state.
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ code: 200, msg: 'Reviews loaded', data: reviewPage });
  } catch (error: unknown) {
    next(error);
  }
};

export const createHumanReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let parsed: ReturnType<typeof parseReviewSubmissionPayload>;
  try {
    parsed = parseReviewSubmissionPayload(req.body?.payload ?? req.body);
  } catch (error: unknown) {
    next(error);
    return;
  }

  if (!req.reviewer) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Reviewer authentication required' },
    });
    return;
  }

  try {
    const photos = Array.isArray(req.files) ? req.files : undefined;
    const review = await ReviewService.createHumanReview(req.reviewer, parsed, photos);
    res.status(201).json({ code: 201, msg: 'Review created', data: { review } });
  } catch (error: unknown) {
    next(error);
  }
};

export const createSimulatorReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = simulatorReviewSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  try {
    const review = await ReviewService.createSimulatorReview(parsed.data);
    res.status(201).json({ code: 201, msg: 'Simulator review created', data: { review } });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteMockGoogleBusinessReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reviewId = reviewUuidSchema.parse(req.params.id);
    await ReviewService.deleteMockGoogleBusinessReview(reviewId);
    res.status(204).send();
  } catch (error: unknown) {
    next(error);
  }
};

const setReviewLike = async (
  req: Request,
  res: Response,
  next: NextFunction,
  liked: boolean,
): Promise<void> => {
  if (!req.reviewer) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Reviewer authentication required' },
    });
    return;
  }

  try {
    const reviewId = googleReviewLikeReviewIdSchema.parse(req.params.id);
    const likeState = await ReviewService.setReviewLike(req.reviewer.id, reviewId, liked);
    res.status(200).json({ code: 200, msg: 'Review like updated', data: { like: likeState } });
  } catch (error: unknown) {
    next(error);
  }
};

export const likeGoogleReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => setReviewLike(req, res, next, true);

export const unlikeGoogleReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => setReviewLike(req, res, next, false);
