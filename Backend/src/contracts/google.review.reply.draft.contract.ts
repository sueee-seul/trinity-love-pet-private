import { z } from 'zod';

export const GOOGLE_REVIEW_REPLY_DRAFT_PATHS = ['praise', 'no_reliable_match'] as const;
export type GoogleReviewReplyDraftPath = (typeof GOOGLE_REVIEW_REPLY_DRAFT_PATHS)[number];

/**
 * Validates the only model-owned field in a generated Google Review draft.
 * Branch, review, and configuration identity are supplied and checked by the Backend.
 */
export const googleReviewReplyDraftModelOutputSchema = z
  .object({
    draftBody: z.string().trim().min(1).max(5_000),
  })
  .strict();

export type GoogleReviewReplyDraftModelOutput = z.infer<
  typeof googleReviewReplyDraftModelOutputSchema
>;

export const googleReviewReplyDraftResultSchema = z
  .object({
    reviewUuid: z.string().uuid(),
    path: z.enum(GOOGLE_REVIEW_REPLY_DRAFT_PATHS),
    draftBody: z.string().trim().min(1).max(5_000),
    configId: z.string().trim().min(1).max(200),
    configVersion: z.number().int().positive(),
  })
  .strict();

export type GoogleReviewReplyDraftResult = z.infer<typeof googleReviewReplyDraftResultSchema>;
