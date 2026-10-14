import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import { summariesForOwner } from '../services/daily-summary.service.js';
import { taskMediaRefOf } from '../services/task.media.js';

/** The updates a stay sent its parent: GET /api/petparent/stays/:bookingPetId/summaries. */
export const getStaySummaries = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
    const bookingPetId = z.string().uuid().parse(req.params.bookingPetId);
    const summaries = await summariesForOwner(req.user.id, bookingPetId);
    res.status(200).json({
      summaries: summaries.map((summary) => ({
        id: summary.id,
        bookingPetId: summary.bookingPetId,
        date: summary.date,
        kind: summary.kind,
        body: summary.body,
        locale: summary.locale,
        // Kept for older readers; `media` says whether the path is a photo or a short video.
        photoPath: summary.photoPath,
        media: taskMediaRefOf(summary.photoPath),
        facts: summary.facts,
        generatedAt: summary.generatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
};
