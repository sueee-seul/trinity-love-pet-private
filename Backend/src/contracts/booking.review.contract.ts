/**
 * Why a manager checks a pet's stay before it is confirmed (services/booking.review-rules.ts).
 * Only medication since the 2026-10-06 terms.
 */
export const MANAGER_REVIEW_REASONS = ['medication'] as const;

export type ManagerReviewReason = (typeof MANAGER_REVIEW_REASONS)[number];
