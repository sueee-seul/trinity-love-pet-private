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
export const GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG = 'PetHouse' as const;
/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const GOOGLE_REVIEW_DASHBOARD_TIME_ZONE = 'Pacific/Auckland' as const;

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS = [
  { key: 'safe', label: 'Safe', minHours: 0, maxHours: 4 },
  { key: 'watch', label: 'Monitor', minHours: 4, maxHours: 12 },
  { key: 'attention', label: 'Reply soon', minHours: 12, maxHours: 24 },
  { key: 'overdue', label: 'Overdue', minHours: 24, maxHours: null },
] as const;

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export type GoogleReviewDashboardAgingBucketKey =
  (typeof GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS)[number]['key'];

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export type GoogleReviewDashboardTriageType = GoogleReviewTriageType | 'unclassified';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return false;
    }

    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }, 'Date must be a valid calendar date');

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export const adminGoogleReviewDashboardQuerySchema = z
  .object({
    placeSlug: reviewPlaceSlugSchema,
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.from && !value.to) || (!value.from && value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.from ? 'to' : 'from'],
        message: 'Both from and to are required when selecting a custom period',
      });
    }

    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'The period end date must not be before the start date',
      });
    }
  });

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export type AdminGoogleReviewDashboardQuery = z.infer<typeof adminGoogleReviewDashboardQuerySchema>;

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardFreshness {
  dataOrigin: 'mock' | 'live';
  lastObservedAt: string | null;
  refreshedAt: string;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardRating {
  average: number | null;
  reviewCount: number;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardMixSegment {
  type: GoogleReviewDashboardTriageType;
  count: number;
  percentage: number;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardFeedbackMix {
  total: number;
  segments: GoogleReviewDashboardMixSegment[];
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardAgingBucket {
  key: GoogleReviewDashboardAgingBucketKey;
  label: string;
  minHours: number;
  maxHours: number | null;
  count: number;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardResponseHealth {
  pendingCount: number;
  oldestWaitingHours: number | null;
  buckets: GoogleReviewDashboardAgingBucket[];
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardFlowPoint {
  periodStart: string;
  receivedCount: number;
  repliedCount: number;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboardFlow {
  granularity: 'half-month';
  points: GoogleReviewDashboardFlowPoint[];
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export interface GoogleReviewDashboard {
  scope: {
    placeSlug: typeof GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG;
    locationName: string;
    periodStart: string;
    periodEnd: string;
    timezone: typeof GOOGLE_REVIEW_DASHBOARD_TIME_ZONE;
    granularity: 'half-month';
  };
  freshness: GoogleReviewDashboardFreshness;
  managerAttention: {
    issuesNeedReview: number;
    overdueReplies: number;
    approachingThreshold: number;
  };
  rating: GoogleReviewDashboardRating;
  feedbackMix: GoogleReviewDashboardFeedbackMix;
  responseHealth: GoogleReviewDashboardResponseHealth;
  feedbackFlow: GoogleReviewDashboardFlow;
}

/**
 * Establishes the authorization boundaries and data integrity rules for this backend contract.
 * Ensures strict control over state transitions and prevents unauthorized access.
 */
export { GOOGLE_REVIEW_TRIAGE_TYPES };
