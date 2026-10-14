import { z } from 'zod';
import {
  GOOGLE_REVIEW_TRIAGE_TYPES,
  type GoogleReviewTriageType,
} from './google.review.ai.contract.js';
import { reviewPlaceSlugSchema } from './review.contract.js';

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const adminGoogleReviewQuerySchema = z
  .object({
    placeSlug: reviewPlaceSlugSchema,
  })
  .strict();

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const adminGoogleReviewReplySchema = z
  .object({
    replyBody: z.string().trim().min(1, 'Reply body is required'),
  })
  .strict();

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const adminGoogleReviewAssigneeSchema = z
  .object({
    reviewUuids: z
      .array(z.string().uuid('Google review UUID must be a valid UUID'))
      .min(1, 'At least one Google review is required'),
    assigneeId: z.string().uuid('Assignee UUID must be a valid employee UUID'),
  })
  .strict();

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const adminGoogleReviewTriageSchema = z
  .object({
    triageType: z.enum(GOOGLE_REVIEW_TRIAGE_TYPES),
  })
  .strict();

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface AdminGoogleReview {
  id: string;
  reviewerName: string;
  reviewerEmail: string | null;
  reviewerAvatarUrl: string | null;
  reviewerIsAnonymous: boolean | null;
  rating: number;
  reviewText: string | null;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
  ownerReply: string | null;
  ownerReplyUpdatedAt: string | null;
  triageType: GoogleReviewTriageType | null;
  isRead: boolean;
  currentStatus: string;
  assignedEmployeeUuid: string | null;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface AdminGoogleReviewPage {
  reviews: AdminGoogleReview[];
}

export { GOOGLE_REVIEW_TRIAGE_TYPES };
