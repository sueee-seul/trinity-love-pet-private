import { pool } from '../config/database.js';
import { getGoogleLocationIdForPlaceSlug } from './review.repository.js';

/**
 * Represents the Google Business Location details for the dashboard, ensuring facility boundary.
 */
export interface GoogleReviewDashboardLocationRecord {
  id: string;
  display_name: string;
  data_origin: 'mock' | 'live';
  last_observed_at: Date | null;
}

/**
 * Represents a summarized Google review for the dashboard interface.
 */
export interface GoogleReviewDashboardReviewRecord {
  id: string;
  rating: number;
  review_text: string | null;
  google_created_at: Date;
  manager_correction: unknown;
  latest_successful_reply_at: Date | null;
}

/**
 * Represents a reply event for a Google review, used to compute reply metrics.
 */
export interface GoogleReviewDashboardReplyEventRecord {
  review_id: string;
  sent_at: Date;
}

/**
 * Encapsulates the entire result set required to render the Google Review dashboard.
 */
export interface GoogleReviewDashboardRepositoryResult {
  location: GoogleReviewDashboardLocationRecord;
  reviews: GoogleReviewDashboardReviewRecord[];
  replyEvents: GoogleReviewDashboardReplyEventRecord[];
}

/**
 * Retrieves the review dashboard records for a specific location, restricted by the place slug.
 * This guarantees the user only accesses dashboard data for the requested facility.
 */
export const findGoogleReviewDashboardRecords = async (
  placeSlug: string,
): Promise<GoogleReviewDashboardRepositoryResult | null> => {
  const googleLocationId = getGoogleLocationIdForPlaceSlug(placeSlug);
  if (!googleLocationId) {
    return null;
  }

  const locationResult = await pool.query<GoogleReviewDashboardLocationRecord>(
    `SELECT
       uuid::text AS id,
       display_name,
       data_origin,
       last_observed_at
     FROM google_business_locations
     WHERE google_location_id = $1
     LIMIT 1`,
    [googleLocationId],
  );
  const location = locationResult.rows[0];
  if (!location) {
    return null;
  }

  const reviewsResult = await pool.query<GoogleReviewDashboardReviewRecord>(
    `SELECT
       review.uuid::text AS id,
       review.rating,
       review.comment AS review_text,
       review.google_created_at,
       latest_manager_correction.event_payload AS manager_correction,
       latest_reply.sent_at AS latest_successful_reply_at
     FROM google_business_reviews review
     LEFT JOIN external_feedback external
       ON external.google_business_review_uuid = review.uuid
     LEFT JOIN LATERAL (
       SELECT event.event_payload
       FROM feedback_timeline_events event
       WHERE event.external_feedback_uuid = external.uuid
         AND event.step = 'manager_correction'
       ORDER BY event.created_at DESC, event.uuid DESC
       LIMIT 1
     ) latest_manager_correction ON true
     LEFT JOIN LATERAL (
       SELECT reply.sent_at
       FROM external_feedback_replies reply
       WHERE reply.external_feedback_uuid = external.uuid
         AND reply.reply_status = 'sent'
         AND reply.sent_at IS NOT NULL
       ORDER BY reply.sent_at DESC, reply.created_at DESC, reply.uuid DESC
       LIMIT 1
     ) latest_reply ON true
     WHERE review.google_business_location_uuid = $1::uuid
       AND review.source_deleted_at IS NULL
     ORDER BY review.google_created_at DESC, review.created_at DESC, review.uuid DESC`,
    [location.id],
  );

  const replyEventsResult = await pool.query<GoogleReviewDashboardReplyEventRecord>(
    `SELECT
       review.uuid::text AS review_id,
       reply.sent_at
     FROM google_business_reviews review
     JOIN external_feedback external
       ON external.google_business_review_uuid = review.uuid
     JOIN external_feedback_replies reply
       ON reply.external_feedback_uuid = external.uuid
     WHERE review.google_business_location_uuid = $1::uuid
       AND review.source_deleted_at IS NULL
       AND reply.reply_status = 'sent'
       AND reply.sent_at IS NOT NULL
     ORDER BY reply.sent_at ASC, reply.uuid ASC`,
    [location.id],
  );

  return {
    location,
    reviews: reviewsResult.rows,
    replyEvents: replyEventsResult.rows,
  };
};
