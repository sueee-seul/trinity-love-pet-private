import { AppError } from '../common/middlewares/error.middleware.js';
import {
  GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
  GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  type AdminGoogleReviewDashboardQuery,
  type GoogleReviewDashboard,
  type GoogleReviewDashboardTriageType,
} from '../contracts/google.review.dashboard.contract.js';
import { findGoogleReviewDashboardRecords } from '../repositories/admin.google.review.dashboard.repository.js';
import { calculateGoogleReviewDashboardMetrics } from './google.review.dashboard.metrics.js';
import { resolveGoogleReviewDashboardPeriod } from './google.review.dashboard.period.js';
import { managerCorrectionSchema } from '../contracts/google.review.manager.correction.contract.js';

const normalizeTriageType = (
  reviewUuid: string,
  managerCorrection: unknown,
): GoogleReviewDashboardTriageType => {
  const correction = managerCorrectionSchema.safeParse(managerCorrection);
  if (managerCorrection === null || managerCorrection === undefined) {
    return 'unclassified';
  }
  if (!correction.success || correction.data.reviewUuid !== reviewUuid) {
    throw new AppError(
      'Google review contains an invalid manual type',
      'INVALID_GOOGLE_REVIEW_TYPE',
      500,
    );
  }
  return correction.data.correctedType;
};

/**
 * Retrieves and calculates the Google review dashboard metrics for a manager.
 *
 * @remarks
 * Restricts query boundaries to the authorized dashboard scope and prevents cross-facility metric leaks.
 */
export const getAdminGoogleReviewDashboard = async (
  query: AdminGoogleReviewDashboardQuery,
): Promise<GoogleReviewDashboard> => {
  if (query.placeSlug.toLowerCase() !== GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG.toLowerCase()) {
    throw new AppError('Review location not found', 'GOOGLE_REVIEW_LOCATION_NOT_FOUND', 404);
  }

  const now = new Date();
  const period = resolveGoogleReviewDashboardPeriod(query, now);

  try {
    const records = await findGoogleReviewDashboardRecords(query.placeSlug);
    if (!records) {
      throw new AppError('Review location not found', 'GOOGLE_REVIEW_LOCATION_NOT_FOUND', 404);
    }

    const reviews = records.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      receivedAt: review.google_created_at,
      triageType: normalizeTriageType(review.id, review.manager_correction),
      latestSuccessfulReplyAt: review.latest_successful_reply_at,
    }));
    const replyEvents = records.replyEvents.map((replyEvent) => ({
      reviewId: replyEvent.review_id,
      sentAt: replyEvent.sent_at,
    }));
    const metrics = calculateGoogleReviewDashboardMetrics({
      reviews,
      replyEvents,
      periodStart: period.start,
      periodEnd: period.end,
      now,
    });

    return {
      scope: {
        placeSlug: GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
        locationName: records.location.display_name,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        timezone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
        granularity: 'half-month',
      },
      freshness: {
        dataOrigin: records.location.data_origin,
        lastObservedAt: records.location.last_observed_at?.toISOString() ?? null,
        refreshedAt: now.toISOString(),
      },
      ...metrics,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to load admin Google review dashboard',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Google review dashboard is temporarily unavailable',
      'GOOGLE_REVIEW_DASHBOARD_UNAVAILABLE',
      503,
    );
  }
};
