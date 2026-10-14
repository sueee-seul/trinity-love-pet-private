import { API_BASE_URL } from '../../../shared/api';
import type {
  GoogleReviewDashboard,
  GoogleReviewDashboardAgingBucket,
  GoogleReviewDashboardFlowPoint,
  GoogleReviewDashboardMixSegment,
  GoogleReviewDashboardQuery,
} from '../types/googleReviewDashboard';

export class GoogleReviewDashboardApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoogleReviewDashboardApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isNonNegativeInteger = (value: unknown): value is number => {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
};

const isTriageType = (value: unknown): boolean => {
  return (
    value === 'issue' || value === 'suggestion' || value === 'praise' || value === 'unclassified'
  );
};

const isAgingBucketKey = (value: unknown): boolean => {
  return value === 'safe' || value === 'watch' || value === 'attention' || value === 'overdue';
};

const isMixSegment = (value: unknown): value is GoogleReviewDashboardMixSegment => {
  return (
    isRecord(value) &&
    isTriageType(value.type) &&
    isNonNegativeInteger(value.count) &&
    isFiniteNumber(value.percentage) &&
    value.percentage >= 0 &&
    value.percentage <= 100
  );
};

const isAgingBucket = (value: unknown): value is GoogleReviewDashboardAgingBucket => {
  return (
    isRecord(value) &&
    isAgingBucketKey(value.key) &&
    typeof value.label === 'string' &&
    isNonNegativeInteger(value.minHours) &&
    (value.maxHours === null || isNonNegativeInteger(value.maxHours)) &&
    isNonNegativeInteger(value.count)
  );
};

const isFlowPoint = (value: unknown): value is GoogleReviewDashboardFlowPoint => {
  return (
    isRecord(value) &&
    typeof value.periodStart === 'string' &&
    isNonNegativeInteger(value.receivedCount) &&
    isNonNegativeInteger(value.repliedCount)
  );
};

const isDashboard = (value: unknown): value is GoogleReviewDashboard => {
  if (!isRecord(value)) {
    return false;
  }

  const { scope, freshness, managerAttention, rating, feedbackMix, responseHealth, feedbackFlow } =
    value;

  return (
    isRecord(scope) &&
    scope.placeSlug === 'PetHouse' &&
    typeof scope.locationName === 'string' &&
    typeof scope.periodStart === 'string' &&
    typeof scope.periodEnd === 'string' &&
    scope.timezone === 'Pacific/Auckland' &&
    scope.granularity === 'half-month' &&
    isRecord(freshness) &&
    (freshness.dataOrigin === 'mock' || freshness.dataOrigin === 'live') &&
    (freshness.lastObservedAt === null || typeof freshness.lastObservedAt === 'string') &&
    typeof freshness.refreshedAt === 'string' &&
    isRecord(managerAttention) &&
    isNonNegativeInteger(managerAttention.issuesNeedReview) &&
    isNonNegativeInteger(managerAttention.overdueReplies) &&
    isNonNegativeInteger(managerAttention.approachingThreshold) &&
    isRecord(rating) &&
    (rating.average === null ||
      (isFiniteNumber(rating.average) && rating.average >= 1 && rating.average <= 5)) &&
    isNonNegativeInteger(rating.reviewCount) &&
    isRecord(feedbackMix) &&
    isNonNegativeInteger(feedbackMix.total) &&
    Array.isArray(feedbackMix.segments) &&
    feedbackMix.segments.every(isMixSegment) &&
    isRecord(responseHealth) &&
    isNonNegativeInteger(responseHealth.pendingCount) &&
    (responseHealth.oldestWaitingHours === null ||
      isFiniteNumber(responseHealth.oldestWaitingHours)) &&
    Array.isArray(responseHealth.buckets) &&
    responseHealth.buckets.every(isAgingBucket) &&
    isRecord(feedbackFlow) &&
    feedbackFlow.granularity === 'half-month' &&
    Array.isArray(feedbackFlow.points) &&
    feedbackFlow.points.every(isFlowPoint)
  );
};

const getResponseMessage = (body: unknown): string | undefined => {
  if (!isRecord(body)) {
    return undefined;
  }

  if (typeof body.message === 'string') {
    return body.message;
  }
  if (typeof body.msg === 'string') {
    return body.msg;
  }
  if (isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }
  return undefined;
};

const getResponseData = (body: unknown): unknown => {
  return isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
};

export const fetchGoogleReviewDashboard = async (
  query: GoogleReviewDashboardQuery,
  signal?: AbortSignal,
): Promise<GoogleReviewDashboard> => {
  const params = new URLSearchParams({ placeSlug: query.placeSlug });
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }

  const response = await fetch(
    `${API_BASE_URL}/admin/google-reviews/dashboard?${params.toString()}`,
    { credentials: 'include', signal },
  );
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new GoogleReviewDashboardApiError(
      getResponseMessage(body) ?? 'Google review dashboard could not be loaded.',
      response.status,
    );
  }

  const data = getResponseData(body);
  if (!isDashboard(data)) {
    throw new Error('Invalid Google review dashboard response');
  }
  return data;
};
