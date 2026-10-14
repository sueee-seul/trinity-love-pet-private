import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { FEEDBACK_TYPES, feedbackRatingDetailsSchema } from '../contracts/feedback.contract.js';
import { generateFeedbackInsights } from '../services/feedback.service.js';

const feedbackInsightsRequestSchema = z.object({
  rating_details: feedbackRatingDetailsSchema,
  raw_answer: z.string().trim().min(1).max(2000),
  category: z.enum(FEEDBACK_TYPES).optional(),
});

export const generateInsights = async (req: Request, res: Response): Promise<void> => {
  const parsed = feedbackInsightsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid feedback for insights' });
    return;
  }

  const { rating_details, raw_answer, category } = parsed.data;
  try {
    const object = await generateFeedbackInsights({
      ratingDetails: rating_details,
      rawAnswer: raw_answer,
      ...(category === undefined ? {} : { category }),
    });
    res.status(200).json(object);
  } catch (error) {
    // The provider's error can echo the prompt, which holds the parent's own words, so only the
    // message is logged and nothing of it reaches the client.
    console.error(
      'LLM Generation Error:',
      error instanceof Error ? error.message : 'Unknown model error',
    );
    res.status(500).json({ error: 'Failed to generate insights' });
  }
};

import * as parentService from '../services/parent.feedback.service.js';

const feedbackSchema = z.object({
  pet_uuid: z.string().uuid(),
  category: z.enum(FEEDBACK_TYPES),
  rating_details: feedbackRatingDetailsSchema,
  raw_answer: z.string().trim().min(1).max(2000),
});

export const submitFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payloadStr = req.body ? req.body.payload : undefined;
    if (!payloadStr) {
      res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Missing payload' } });
      return;
    }

    // Parse JSON payload
    let payloadObj: unknown;
    try {
      payloadObj = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
    } catch {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_FAILED', message: 'Invalid JSON payload' } });
      return;
    }

    const validatedPayload = feedbackSchema.parse(payloadObj);

    const audioFile = req.file; // From multer

    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const newFeedback = await parentService.createFeedback(
      validatedPayload,
      req.user.id,
      audioFile,
    );

    res.status(201).json({
      uuid: newFeedback.uuid,
      pet_uuid: validatedPayload.pet_uuid,
      pet_owners_uuid: req.user.id,
      category: newFeedback.category,
      rating: newFeedback.rating,
      rating_details: validatedPayload.rating_details,
      raw_answer: validatedPayload.raw_answer,
      transcript: newFeedback.transcript ?? null,
      audio_url: newFeedback.audio_url ?? null,
      ai_insights: {
        summary: newFeedback.ai_insights.summary,
        insights: newFeedback.ai_insights.insights,
      },
    });
  } catch (error) {
    next(error);
  }
};
