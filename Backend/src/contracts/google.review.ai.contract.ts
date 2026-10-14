export const GOOGLE_REVIEW_TRIAGE_TYPES = ['praise', 'issue', 'suggestion', 'general'] as const;
export type GoogleReviewTriageType = (typeof GOOGLE_REVIEW_TRIAGE_TYPES)[number];
