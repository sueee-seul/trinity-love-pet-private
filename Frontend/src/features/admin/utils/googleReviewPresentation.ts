import type { AdminGoogleReview, GoogleReviewTriageType } from '../types/googleReview';
import {
  formatFeedbackCalendarDate,
  formatFeedbackCalendarDateLabel,
  formatFeedbackSubmissionTime,
} from './feedbackTime';

/**
 * Returns the reviewer label used by employee Google Review surfaces.
 *
 * @remarks
 * Anonymous reviews and empty/whitespace-only names are shown as `Anonymous reviewer`; a named
 * reviewer is trimmed before display. The result is display-only and does not update the API
 * projection.
 */
export const getGoogleReviewDisplayName = (review: AdminGoogleReview): string => {
  const reviewerName = review.reviewerName.trim();
  if (review.reviewerIsAnonymous === true || reviewerName.length === 0) {
    return 'Anonymous reviewer';
  }

  return reviewerName;
};

/** Returns an uppercase display initial, or `?` when no usable name is available. */
export const getGoogleReviewInitial = (reviewerName: string): string => {
  return reviewerName.trim().charAt(0).toUpperCase() || '?';
};

const GOOGLE_REVIEW_TRIAGE_LABELS: Record<GoogleReviewTriageType, string> = {
  issue: 'Issue',
  praise: 'Praise',
  suggestion: 'Suggestion',
  general: 'General',
};

/** Returns the manager-facing title for a manually assigned review type. */
export const getGoogleReviewTriageTypeLabel = (triageType: GoogleReviewTriageType): string => {
  return GOOGLE_REVIEW_TRIAGE_LABELS[triageType];
};

/** Returns the manually assigned review type or an explicit unclassified state. */
export const getGoogleReviewTriageDisplay = (triageType: GoogleReviewTriageType | null): string => {
  return triageType ? getGoogleReviewTriageTypeLabel(triageType) : 'Unclassified';
};

/**
 * Formats a review timestamp for the employee Google Review UI.
 *
 * @remarks
 * Valid timestamps use the shared `Pacific/Auckland` calendar/time formatting and receive an ISO
 * `dateTime`; invalid timestamps show `Date unavailable` without an invented machine-readable date.
 */
export const formatGoogleReviewDate = (createdAt: string): { label: string; dateTime?: string } => {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return { label: 'Date unavailable' };
  }

  const calendarDate = formatFeedbackCalendarDate(timestamp);
  return {
    label: `${formatFeedbackCalendarDateLabel(calendarDate)} • ${formatFeedbackSubmissionTime(timestamp)}`,
    dateTime: new Date(timestamp).toISOString(),
  };
};
