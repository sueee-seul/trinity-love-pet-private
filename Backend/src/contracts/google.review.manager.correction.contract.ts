import { z } from 'zod';
import {
  GOOGLE_REVIEW_TRIAGE_TYPES,
  type GoogleReviewTriageType,
} from './google.review.ai.contract.js';

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const managerCorrectionSchema = z
  .object({
    correctionId: z.string().uuid(),
    reviewUuid: z.string().uuid(),
    sourceRunId: z.string().uuid().nullable(),
    originalAiType: z.enum(GOOGLE_REVIEW_TRIAGE_TYPES).nullable(),
    correctedType: z.enum(GOOGLE_REVIEW_TRIAGE_TYPES),
    managerId: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.originalAiType !== null && value.originalAiType === value.correctedType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctedType'],
        message: 'A manager correction must change the AI triage type',
      });
    }
  });

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export type GoogleReviewManagerCorrection = z.infer<typeof managerCorrectionSchema>;
/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export type GoogleReviewManagerCorrectionType = GoogleReviewTriageType;
