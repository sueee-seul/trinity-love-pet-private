import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import {
  deleteGoogleReviewNotifications,
  insertGoogleReviewReceiptNotifications,
} from './google.review.notification.repository.js';

export type ReviewSource = 'human' | 'simulator';
export type ServiceUserMatchStatus = 'pending';

export interface CreateReviewRecordInput {
  reviewerId: string;
  placeSlug: string;
  rating: number;
  reviewText: string | null;
  source: ReviewSource;
}

export interface CreatedReviewRecord {
  id: string;
  reviewer_id: string;
  place_slug: string;
  rating: number;
  review_text: string | null;
  source: ReviewSource;
  service_user_match_status: ServiceUserMatchStatus;
  created_at: Date;
}

export interface GoogleBusinessLocationRecord {
  id: string;
  display_name: string;
  formatted_address: string | null;
  google_maps_uri: string | null;
  aggregate_rating: number | null;
  user_rating_count: number;
}

export interface GoogleBusinessReviewRecord {
  id: string;
  reviewer_display_name: string | null;
  reviewer_profile_photo_url: string | null;
  reviewer_is_anonymous: boolean | null;
  rating: number;
  comment: string | null;
  google_created_at: Date;
  google_updated_at: Date;
  owner_reply: string | null;
  owner_reply_updated_at: Date | null;
  photo_urls?: string[];
  like_count: number;
  viewer_has_liked: boolean;
}

export interface GoogleBusinessReviewPageRecord {
  location: GoogleBusinessLocationRecord;
  reviews: GoogleBusinessReviewRecord[];
}

export interface CreateGoogleBusinessReviewRecordInput {
  reviewerId: string;
  reviewerDisplayName: string;
  reviewerAvatarUrl: string | null;
  placeSlug: string;
  rating: number;
  reviewText: string | null;
  photoUrls?: readonly string[];
  notifyActiveManagers?: boolean;
}

const GOOGLE_LOCATION_ID_BY_PLACE_SLUG: Readonly<Record<string, string>> = {
  pethouse: 'mock-pethouse-location',
};

export const getGoogleLocationIdForPlaceSlug = (placeSlug: string): string | null => {
  return GOOGLE_LOCATION_ID_BY_PLACE_SLUG[placeSlug.toLowerCase()] ?? null;
};

/**
 * Loads the public review page for a place, including per-review like totals.
 *
 * @param viewerReviewerId - Signed-in reviewer identity, or null for an anonymous visitor.
 *   Like counts are returned either way; only `viewer_has_liked` depends on it.
 */
export const findGoogleBusinessReviewPage = async (
  placeSlug: string,
  viewerReviewerId: string | null = null,
): Promise<GoogleBusinessReviewPageRecord | null> => {
  const googleLocationId = getGoogleLocationIdForPlaceSlug(placeSlug);
  if (!googleLocationId) {
    return null;
  }

  const locationResult = await pool.query<GoogleBusinessLocationRecord>(
    `SELECT
       uuid::text AS id,
       display_name,
       formatted_address,
       google_maps_uri,
       aggregate_rating::double precision AS aggregate_rating,
       user_rating_count
     FROM google_business_locations
     WHERE google_location_id = $1
     LIMIT 1`,
    [googleLocationId],
  );
  const location = locationResult.rows[0];
  if (!location) {
    return null;
  }

  const reviewsResult = await pool.query<GoogleBusinessReviewRecord>(
    `SELECT
       uuid::text AS id,
       reviewer_display_name,
       reviewer_profile_photo_url,
       reviewer_is_anonymous,
       rating,
       comment,
       google_created_at,
       google_updated_at,
       latest_reply.reply_body AS owner_reply,
       latest_reply.sent_at AS owner_reply_updated_at,
       COALESCE((SELECT array_agg(media.photo_url ORDER BY media.created_at)
          FROM google_review_media_logs media
          WHERE media.google_business_reviews_uuid = google_business_reviews.uuid), ARRAY[]::text[]) AS photo_urls,
       (SELECT count(*)
          FROM google_review_likes likes
          WHERE likes.google_business_review_uuid = google_business_reviews.uuid)::int AS like_count,
       EXISTS (SELECT 1
          FROM google_review_likes viewer_like
          WHERE viewer_like.google_business_review_uuid = google_business_reviews.uuid
            AND viewer_like.reviewer_uuid = $2::uuid) AS viewer_has_liked
     FROM google_business_reviews
     LEFT JOIN LATERAL (
       SELECT reply.reply_body, reply.sent_at
       FROM external_feedback_replies reply
       JOIN external_feedback feedback
         ON feedback.uuid = reply.external_feedback_uuid
       WHERE feedback.google_business_review_uuid = google_business_reviews.uuid
         AND reply.reply_status = 'sent'
       ORDER BY reply.created_at DESC, reply.sent_at DESC, reply.uuid DESC
       LIMIT 1
     ) latest_reply ON true
     WHERE google_business_location_uuid = $1::uuid
     ORDER BY google_created_at DESC, created_at DESC, uuid DESC`,
    [location.id, viewerReviewerId],
  );

  return { location, reviews: reviewsResult.rows };
};

export const createGoogleBusinessReviewRecord = async (
  input: CreateGoogleBusinessReviewRecordInput,
): Promise<CreatedReviewRecord> => {
  const googleLocationId = getGoogleLocationIdForPlaceSlug(input.placeSlug);
  if (!googleLocationId) {
    throw new Error(`Unsupported review location: ${input.placeSlug}`);
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
    throw new Error(`Google review location is not configured: ${googleLocationId}`);
  }

  const reviewId = `mock-pethouse-review-${randomUUID()}`;
  const resourceName = `accounts/mock-pethouse-account/locations/${googleLocationId}/reviews/${reviewId}`;
  const result = await withDatabaseTransaction<CreatedReviewRecord>(async (client) => {
    const result = await client.query<CreatedReviewRecord>(
      `INSERT INTO google_business_reviews (
       google_business_location_uuid,
       google_review_id,
       google_resource_name,
       reviewer_display_name,
       reviewer_profile_photo_url,
       reviewer_is_anonymous,
       rating,
       comment,
       google_created_at,
       google_updated_at,
       data_origin
     )
     VALUES ($1::uuid, $2, $3, $4, $5, false, $6, $7, now(), now(), 'mock')
     RETURNING
       uuid::text AS id,
       $8::text AS reviewer_id,
       $9::text AS place_slug,
       rating,
       comment AS review_text,
       'human' AS source,
       'pending' AS service_user_match_status,
       created_at`,
      [
        location.uuid,
        reviewId,
        resourceName,
        input.reviewerDisplayName,
        input.reviewerAvatarUrl,
        input.rating,
        input.reviewText,
        input.reviewerId,
        input.placeSlug,
      ],
    );

    const review = result.rows[0];
    if (!review) {
      throw new Error('Review insert returned no review');
    }
    const photoCreatedAtBase = Date.now();
    for (const [index, photoUrl] of (input.photoUrls ?? []).entries()) {
      await client.query(
        `INSERT INTO google_review_media_logs (
           google_business_reviews_uuid,
           photo_url,
           created_at
         )
         VALUES ($1::uuid, $2, $3)`,
        [review.id, photoUrl, new Date(photoCreatedAtBase + index)],
      );
    }
    const externalFeedbackResult = await client.query<{ uuid: string }>(
      `INSERT INTO external_feedback (
         google_business_review_uuid
       )
       VALUES ($1::uuid)
       RETURNING uuid::text AS uuid`,
      [review.id],
    );
    const externalFeedbackUuid = externalFeedbackResult.rows[0]?.uuid;
    if (!externalFeedbackUuid) {
      throw new Error('External feedback insert returned no record');
    }
    if (input.notifyActiveManagers === true) {
      await insertGoogleReviewReceiptNotifications(client, {
        reviewUuid: review.id,
        externalFeedbackUuid,
        placeSlug: input.placeSlug,
        reviewerName: input.reviewerDisplayName,
        rating: input.rating,
      });
    }
    return { transaction: 'commit', value: review };
  });

  return result;
};

export const createReviewRecord = async (
  input: CreateReviewRecordInput,
): Promise<CreatedReviewRecord> => {
  const result = await pool.query<CreatedReviewRecord>(
    `INSERT INTO place_reviews (
       reviewer_uuid,
       place_slug,
       rating,
       review_text,
       source,
       service_user_match_status
     )
     VALUES ($1::uuid, $2, $3, $4, $5, 'pending')
     RETURNING
       uuid::text AS id,
       reviewer_uuid::text AS reviewer_id,
       place_slug,
       rating,
       review_text,
       source,
       service_user_match_status,
       created_at`,
    [input.reviewerId, input.placeSlug, input.rating, input.reviewText, input.source],
  );

  const review = result.rows[0];
  if (!review) {
    throw new Error('Review insert returned no review');
  }

  return review;
};

export interface DeletedGoogleBusinessReviewRecord {
  photoUrls: string[];
}

export const deleteMockGoogleBusinessReviewRecord = async (
  reviewId: string,
): Promise<DeletedGoogleBusinessReviewRecord | null> => {
  return withDatabaseTransaction<DeletedGoogleBusinessReviewRecord | null>(async (client) => {
    const existingResult = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid
       FROM google_business_reviews r
       WHERE uuid = $1::uuid
         AND data_origin = 'mock'
       FOR UPDATE`,
      [reviewId],
    );

    if (!existingResult.rows[0]) {
      return { transaction: 'rollback', value: null };
    }

    const mediaResult = await client.query<{ photo_urls: string[] }>(
      `SELECT COALESCE(array_agg(photo_url), ARRAY[]::text[]) AS photo_urls
       FROM google_review_media_logs
       WHERE google_business_reviews_uuid = $1::uuid`,
      [reviewId],
    );

    await deleteGoogleReviewNotifications(client, reviewId);

    await client.query(
      `DELETE FROM external_feedback
       WHERE google_business_review_uuid = $1::uuid`,
      [reviewId],
    );

    const deleteResult = await client.query<{ uuid: string }>(
      `DELETE FROM google_business_reviews
       WHERE uuid = $1::uuid
         AND data_origin = 'mock'
       RETURNING uuid::text AS uuid`,
      [reviewId],
    );

    if (!deleteResult.rows[0]) {
      throw new Error('Mock Google review deletion returned no UUID');
    }

    return {
      transaction: 'commit',
      value: { photoUrls: mediaResult.rows[0]?.photo_urls ?? [] },
    };
  });
};
