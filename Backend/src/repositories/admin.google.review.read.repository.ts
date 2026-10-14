import { pool } from '../config/database.js';
import {
  GOOGLE_REVIEW_PROJECTION,
  LATEST_MANAGER_CORRECTION_JOIN,
  LATEST_REPLY_JOIN,
  UNIQUE_REVIEWER_IDENTITY_JOIN,
} from './admin.google.review.sql.js';
import type {
  AdminGoogleBusinessReviewRecord,
  AdminGoogleReviewActor,
} from './admin.google.review.repository.types.js';
import { getGoogleLocationIdForPlaceSlug } from './review.repository.js';

/**
 * Retrieves administrative Google reviews for a specified location,
 * applying facility boundary and role-based access constraints.
 */
export const findAdminGoogleBusinessReviews = async (
  placeSlug: string,
  actor: AdminGoogleReviewActor,
): Promise<AdminGoogleBusinessReviewRecord[] | null> => {
  const googleLocationId = getGoogleLocationIdForPlaceSlug(placeSlug);
  if (!googleLocationId) {
    return null;
  }

  const locationResult = await pool.query<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM google_business_locations
     WHERE google_location_id = $1
     LIMIT 1`,
    [googleLocationId],
  );
  const location = locationResult.rows[0];
  if (!location) {
    return null;
  }

  const reviewsResult = await pool.query<AdminGoogleBusinessReviewRecord>(
    `SELECT
       ${GOOGLE_REVIEW_PROJECTION}
      FROM google_business_reviews review
      ${UNIQUE_REVIEWER_IDENTITY_JOIN}
      LEFT JOIN external_feedback external
       ON external.google_business_review_uuid = review.uuid
      ${LATEST_MANAGER_CORRECTION_JOIN}
      ${LATEST_REPLY_JOIN}
     WHERE review.google_business_location_uuid = $1::uuid
       ${actor.role === 'staff' ? 'AND external.assigned_employee_uuid = $2::uuid' : ''}
     ORDER BY review.google_created_at DESC, review.created_at DESC, review.uuid DESC`,
    actor.role === 'staff' ? [location.uuid, actor.id] : [location.uuid],
  );

  return reviewsResult.rows;
};
