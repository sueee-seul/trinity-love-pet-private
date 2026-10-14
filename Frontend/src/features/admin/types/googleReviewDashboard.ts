export const GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG = 'PetHouse' as const;
export const GOOGLE_REVIEW_DASHBOARD_TIME_ZONE = 'Pacific/Auckland' as const;

export const GOOGLE_REVIEW_DASHBOARD_PERIODS = [
  'last_7_days',
  'last_30_days',
  'last_12_months',
] as const;

export type GoogleReviewDashboardPeriod = (typeof GOOGLE_REVIEW_DASHBOARD_PERIODS)[number];

export type GoogleReviewDashboardTriageType = 'issue' | 'suggestion' | 'praise' | 'unclassified';

export type GoogleReviewDashboardAgingBucketKey = 'safe' | 'watch' | 'attention' | 'overdue';

export interface GoogleReviewDashboardQuery {
  placeSlug: string;
  from?: string;
  to?: string;
}

export interface GoogleReviewDashboardFreshness {
  dataOrigin: 'mock' | 'live';
  lastObservedAt: string | null;
  refreshedAt: string;
}

export interface GoogleReviewDashboardRating {
  average: number | null;
  reviewCount: number;
}

export interface GoogleReviewDashboardMixSegment {
  type: GoogleReviewDashboardTriageType;
  count: number;
  percentage: number;
}

export interface GoogleReviewDashboardFeedbackMix {
  total: number;
  segments: GoogleReviewDashboardMixSegment[];
}

export interface GoogleReviewDashboardAgingBucket {
  key: GoogleReviewDashboardAgingBucketKey;
  label: string;
  minHours: number;
  maxHours: number | null;
  count: number;
}

export interface GoogleReviewDashboardResponseHealth {
  pendingCount: number;
  oldestWaitingHours: number | null;
  buckets: GoogleReviewDashboardAgingBucket[];
}

export interface GoogleReviewDashboardFlowPoint {
  periodStart: string;
  receivedCount: number;
  repliedCount: number;
}

export interface GoogleReviewDashboardFlow {
  granularity: 'half-month';
  points: GoogleReviewDashboardFlowPoint[];
}

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

export type GoogleReviewDashboardStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export interface GoogleReviewDashboardState {
  dashboard: GoogleReviewDashboard | null;
  status: GoogleReviewDashboardStatus;
  error: string | null;
  refresh: () => void;
}
