import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  MAX_DETAILS_TEXT,
  readBookingDetails,
} from '../services/concierge/concierge.details-reader.js';

const readRequestSchema = z
  .object({ text: z.string().trim().min(5).max(MAX_DETAILS_TEXT) })
  .strict();

/**
 * POST /api/concierge/details/read: the booking form's spoken or typed description, read into a
 * draft the guest confirms. Public like the rest of the booking page, so it has its own budget.
 */
export const postConciergeDetailsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { text } = readRequestSchema.parse(req.body);
    res.status(200).json({ draft: await readBookingDetails(text) });
  } catch (error) {
    next(error);
  }
};
