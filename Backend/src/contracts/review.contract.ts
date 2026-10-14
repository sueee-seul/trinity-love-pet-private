import { z } from 'zod';

const PLACE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
export const REVIEW_TEXT_MAX_LENGTH = 2000;
export const reviewPlaceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    PLACE_SLUG_PATTERN,
    'Place slug must contain only letters, numbers, hyphens, or underscores',
  );

export const reviewSubmissionSchema = z
  .object({
    placeSlug: reviewPlaceSlugSchema,
    rating: z.number().int().min(1).max(5),
    reviewText: z.string().trim().max(REVIEW_TEXT_MAX_LENGTH).optional(),
  })
  .strict();

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

export const parseReviewSubmissionPayload = (payload: unknown): ReviewSubmission => {
  let parsedPayload: unknown = payload;
  if (typeof payload === 'string') {
    try {
      parsedPayload = JSON.parse(payload) as unknown;
    } catch {
      throw new z.ZodError([
        { code: z.ZodIssueCode.custom, path: ['payload'], message: 'Invalid JSON review payload' },
      ]);
    }
  }
  return reviewSubmissionSchema.parse(parsedPayload);
};

export const reviewPageQuerySchema = z
  .object({
    placeSlug: reviewPlaceSlugSchema,
  })
  .strict();

export const simulatorReviewSubmissionSchema = reviewSubmissionSchema
  .extend({
    authorKey: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(1).max(150),
    avatarUrl: z.string().trim().url().max(500).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
  })
  .strict();

export type SimulatorReviewSubmission = z.infer<typeof simulatorReviewSubmissionSchema>;
