import {
  GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS,
  GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  type GoogleReviewDashboardAgingBucketKey,
  type GoogleReviewDashboardFeedbackMix,
  type GoogleReviewDashboardFlow,
  type GoogleReviewDashboardRating,
  type GoogleReviewDashboardResponseHealth,
  type GoogleReviewDashboardTriageType,
} from '../contracts/google.review.dashboard.contract.js';

const AUCKLAND_YEAR_MONTH_FORMATTER = new Intl.DateTimeFormat('en-NZ', {
  timeZone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type GoogleReviewDashboardAgingDefinition = (typeof GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS)[number];

/**
 * Input format for a single Google review when calculating dashboard metrics.
 */
export interface GoogleReviewDashboardReviewInput {
  id: string;
  rating: number;
  receivedAt: Date;
  triageType: GoogleReviewDashboardTriageType;
  latestSuccessfulReplyAt: Date | null;
}

/**
 * Input format for a reply event when calculating dashboard metrics.
 */
export interface GoogleReviewDashboardReplyEventInput {
  reviewId: string;
  sentAt: Date;
}

/**
 * The aggregated input data required to compute Google review dashboard metrics.
 */
export interface GoogleReviewDashboardMetricsInput {
  reviews: readonly GoogleReviewDashboardReviewInput[];
  replyEvents: readonly GoogleReviewDashboardReplyEventInput[];
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}

/**
 * The computed dashboard metrics structure.
 */
export interface GoogleReviewDashboardMetrics {
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

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

const PERCENTAGE_TENTHS = 1000;

interface FeedbackMixPercentageInput {
  type: GoogleReviewDashboardTriageType;
  count: number;
}

interface FeedbackMixPercentageAllocation extends FeedbackMixPercentageInput {
  baseTenths: number;
  remainder: number;
  index: number;
}

const calculateRoundedMixPercentages = (
  segments: readonly FeedbackMixPercentageInput[],
  total: number,
): Map<GoogleReviewDashboardTriageType, number> => {
  const allocations: FeedbackMixPercentageAllocation[] = segments.map((segment, index) => {
    const exactTenths = (segment.count * PERCENTAGE_TENTHS) / total;
    const baseTenths = Math.floor(exactTenths);
    return {
      ...segment,
      baseTenths,
      remainder: exactTenths - baseTenths,
      index,
    };
  });

  const remainingTenths =
    PERCENTAGE_TENTHS - allocations.reduce((sum, allocation) => sum + allocation.baseTenths, 0);
  const allocationOrder = [...allocations].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  );

  for (let index = 0; index < remainingTenths; index += 1) {
    const allocation = allocationOrder[index];
    if (!allocation) {
      break;
    }
    allocation.baseTenths += 1;
  }

  return new Map(allocations.map((allocation) => [allocation.type, allocation.baseTenths / 10]));
};

const isWithinPeriod = (value: Date, periodStart: Date, periodEnd: Date): boolean => {
  const timestamp = value.getTime();
  return timestamp >= periodStart.getTime() && timestamp < periodEnd.getTime();
};

const getWaitingHours = (receivedAt: Date, now: Date): number => {
  return Math.max(0, now.getTime() - receivedAt.getTime()) / (60 * 60 * 1000);
};

const getAgingBucket = (waitingHours: number): GoogleReviewDashboardAgingDefinition => {
  const bucket = GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS.find(
    ({ minHours, maxHours }) =>
      waitingHours >= minHours && (maxHours === null || waitingHours < maxHours),
  );

  if (!bucket) {
    throw new Error(`No response aging bucket for ${waitingHours} hours`);
  }

  return bucket;
};

const getAucklandHalfMonthKey = (date: Date): string => {
  const parts = AUCKLAND_YEAR_MONTH_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  if (!year || !month || !day) {
    throw new Error('Could not determine Auckland half-month for dashboard flow');
  }
  return `${year}-${month}-${day <= 15 ? '01' : '16'}`;
};

const getHalfMonthIndex = (year: number, month: number, day: number): number => {
  return year * 24 + (month - 1) * 2 + (day <= 15 ? 0 : 1);
};

const getHalfMonthParts = (index: number): { year: number; month: number; day: number } => {
  const year = Math.floor(index / 24);
  const monthIndex = index % 24;
  return {
    year,
    month: Math.floor(monthIndex / 2) + 1,
    day: monthIndex % 2 === 0 ? 1 : 16,
  };
};

const getHalfMonthKeys = (periodStart: Date, periodEnd: Date): string[] => {
  const firstParts = AUCKLAND_YEAR_MONTH_FORMATTER.formatToParts(periodStart);
  const lastParts = AUCKLAND_YEAR_MONTH_FORMATTER.formatToParts(new Date(periodEnd.getTime() - 1));
  const firstYear = Number(firstParts.find((part) => part.type === 'year')?.value);
  const firstMonth = Number(firstParts.find((part) => part.type === 'month')?.value);
  const firstDay = Number(firstParts.find((part) => part.type === 'day')?.value);
  const lastYear = Number(lastParts.find((part) => part.type === 'year')?.value);
  const lastMonth = Number(lastParts.find((part) => part.type === 'month')?.value);
  const lastDay = Number(lastParts.find((part) => part.type === 'day')?.value);

  if (!firstYear || !firstMonth || !firstDay || !lastYear || !lastMonth || !lastDay) {
    throw new Error('Could not parse dashboard flow half-month range');
  }

  const firstIndex = getHalfMonthIndex(firstYear, firstMonth, firstDay);
  const lastIndex = getHalfMonthIndex(lastYear, lastMonth, lastDay);
  const keys: string[] = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const parts = getHalfMonthParts(index);
    keys.push(
      `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    );
  }
  return keys;
};

const calculateRating = (
  periodReviews: readonly GoogleReviewDashboardReviewInput[],
): GoogleReviewDashboardRating => {
  if (periodReviews.length === 0) {
    return { average: null, reviewCount: 0 };
  }

  const totalRating = periodReviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    average: roundToOneDecimal(totalRating / periodReviews.length),
    reviewCount: periodReviews.length,
  };
};

const calculateFeedbackMix = (
  periodReviews: readonly GoogleReviewDashboardReviewInput[],
): GoogleReviewDashboardFeedbackMix => {
  const types: readonly GoogleReviewDashboardTriageType[] = [
    'issue',
    'suggestion',
    'praise',
    'unclassified',
  ];
  const counts = new Map<GoogleReviewDashboardTriageType, number>(types.map((type) => [type, 0]));

  for (const review of periodReviews) {
    counts.set(review.triageType, (counts.get(review.triageType) ?? 0) + 1);
  }

  const total = periodReviews.length;
  return {
    total,
    segments: total === 0 ? [] : calculateMixSegments(types, counts, total),
  };
};

const calculateMixSegments = (
  types: readonly GoogleReviewDashboardTriageType[],
  counts: ReadonlyMap<GoogleReviewDashboardTriageType, number>,
  total: number,
): GoogleReviewDashboardFeedbackMix['segments'] => {
  const populatedSegments = types
    .filter((type) => (counts.get(type) ?? 0) > 0)
    .map((type) => ({ type, count: counts.get(type) ?? 0 }));
  const percentages = calculateRoundedMixPercentages(populatedSegments, total);

  return populatedSegments.map((segment) => ({
    ...segment,
    percentage: percentages.get(segment.type) ?? 0,
  }));
};

const calculateManagerAttention = (
  reviews: readonly GoogleReviewDashboardReviewInput[],
  now: Date,
): GoogleReviewDashboardMetrics['managerAttention'] => {
  let issuesNeedReview = 0;
  let overdueReplies = 0;
  let approachingThreshold = 0;

  for (const review of reviews) {
    if (review.latestSuccessfulReplyAt !== null) {
      continue;
    }

    const waitingHours = getWaitingHours(review.receivedAt, now);
    if (review.triageType === 'issue') {
      issuesNeedReview += 1;
    }
    if (waitingHours >= 24) {
      overdueReplies += 1;
    } else if (waitingHours >= 12) {
      approachingThreshold += 1;
    }
  }

  return { issuesNeedReview, overdueReplies, approachingThreshold };
};

const calculateResponseHealth = (
  reviews: readonly GoogleReviewDashboardReviewInput[],
  now: Date,
): GoogleReviewDashboardResponseHealth => {
  const counts = new Map<GoogleReviewDashboardAgingBucketKey, number>(
    GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS.map(({ key }) => [key, 0]),
  );
  let pendingCount = 0;
  let oldestWaitingHours: number | null = null;

  for (const review of reviews) {
    if (review.latestSuccessfulReplyAt !== null) {
      continue;
    }

    const waitingHours = getWaitingHours(review.receivedAt, now);
    const bucket = getAgingBucket(waitingHours);
    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
    pendingCount += 1;
    oldestWaitingHours =
      oldestWaitingHours === null ? waitingHours : Math.max(oldestWaitingHours, waitingHours);
  }

  return {
    pendingCount,
    oldestWaitingHours: oldestWaitingHours === null ? null : roundToOneDecimal(oldestWaitingHours),
    buckets: GOOGLE_REVIEW_DASHBOARD_AGING_BUCKETS.map((bucket) => ({
      ...bucket,
      count: counts.get(bucket.key) ?? 0,
    })),
  };
};

const calculateFeedbackFlow = (
  reviews: readonly GoogleReviewDashboardReviewInput[],
  replyEvents: readonly GoogleReviewDashboardReplyEventInput[],
  periodStart: Date,
  periodEnd: Date,
): GoogleReviewDashboardFlow => {
  const halfMonthKeys = getHalfMonthKeys(periodStart, periodEnd);
  const receivedByHalfMonth = new Map<string, Set<string>>(
    halfMonthKeys.map((halfMonthKey) => [halfMonthKey, new Set<string>()]),
  );
  const repliedByHalfMonth = new Map<string, Set<string>>(
    halfMonthKeys.map((halfMonthKey) => [halfMonthKey, new Set<string>()]),
  );

  for (const review of reviews) {
    if (!isWithinPeriod(review.receivedAt, periodStart, periodEnd)) {
      continue;
    }
    receivedByHalfMonth.get(getAucklandHalfMonthKey(review.receivedAt))?.add(review.id);
  }

  for (const replyEvent of replyEvents) {
    if (!isWithinPeriod(replyEvent.sentAt, periodStart, periodEnd)) {
      continue;
    }
    repliedByHalfMonth.get(getAucklandHalfMonthKey(replyEvent.sentAt))?.add(replyEvent.reviewId);
  }

  return {
    granularity: 'half-month',
    points: halfMonthKeys.map((halfMonthKey) => ({
      periodStart: halfMonthKey,
      receivedCount: receivedByHalfMonth.get(halfMonthKey)?.size ?? 0,
      repliedCount: repliedByHalfMonth.get(halfMonthKey)?.size ?? 0,
    })),
  };
};

/**
 * Calculates the dashboard metrics for a given set of Google reviews and reply events.
 *
 * @remarks
 * Uses role-based inputs to summarize response health, feedback mix, and manager attention areas.
 */
export const calculateGoogleReviewDashboardMetrics = ({
  reviews,
  replyEvents,
  periodStart,
  periodEnd,
  now,
}: GoogleReviewDashboardMetricsInput): GoogleReviewDashboardMetrics => {
  const periodReviews = reviews.filter((review) =>
    isWithinPeriod(review.receivedAt, periodStart, periodEnd),
  );

  return {
    managerAttention: calculateManagerAttention(periodReviews, now),
    rating: calculateRating(periodReviews),
    feedbackMix: calculateFeedbackMix(periodReviews),
    responseHealth: calculateResponseHealth(periodReviews, now),
    feedbackFlow: calculateFeedbackFlow(reviews, replyEvents, periodStart, periodEnd),
  };
};
