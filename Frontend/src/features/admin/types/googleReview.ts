import type { GoogleBusinessReview } from '../../maps-review/types/reviewTypes';

export const GOOGLE_REVIEW_TRIAGE_TYPES = ['issue', 'praise', 'suggestion', 'general'] as const;
export type GoogleReviewTriageType = (typeof GOOGLE_REVIEW_TRIAGE_TYPES)[number];

/**
 * Employee/admin projection of a Google business review.
 *
 * @remarks
 * The base review fields are shared with the public mock review data shape; these additional
 * fields carry employee-facing manual type, read-state, workflow, and assignment metadata. This
 * is a separate source model from Internal Feedback even when a shared table displays it.
 */
export interface AdminGoogleReview extends GoogleBusinessReview {
  reviewerEmail: string | null;
  triageType: GoogleReviewTriageType | null;
  isRead: boolean;
  currentStatus: string;
  assignedEmployeeUuid: string | null;
}

/** Page-shaped employee projection returned by the admin Google Review API. */
export interface AdminGoogleReviewPage {
  reviews: AdminGoogleReview[];
}
