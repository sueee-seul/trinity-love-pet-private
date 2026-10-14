import { randomUUID } from 'node:crypto';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import { type GoogleReviewTriageType } from '../contracts/google.review.ai.contract.js';
import { managerCorrectionSchema } from '../contracts/google.review.manager.correction.contract.js';
import {
  GOOGLE_REVIEW_PROJECTION,
  LATEST_MANAGER_CORRECTION_JOIN,
  LATEST_REPLY_JOIN,
  UNIQUE_REVIEWER_IDENTITY_JOIN,
} from './admin.google.review.sql.js';
import type {
  AdminGoogleBusinessReviewRecord,
  UpdateGoogleReviewTriageResult,
} from './admin.google.review.repository.types.js';

/**
 * Records a human manager's manual review type as an immutable timeline event.
 */
export const updateGoogleReviewTriage = async (
  reviewId: string,
  triageType: GoogleReviewTriageType,
  managerId: string,
): Promise<UpdateGoogleReviewTriageResult> => {
  return withDatabaseTransaction<UpdateGoogleReviewTriageResult>(async (client) => {
    const existingResult = await client.query<{
      id: string;
      external_feedback_uuid: string | null;
    }>(
      `SELECT review.uuid::text AS id,
              external.uuid::text AS external_feedback_uuid
       FROM google_business_reviews review
       JOIN google_business_locations location
         ON location.uuid = review.google_business_location_uuid
       LEFT JOIN external_feedback external
         ON external.google_business_review_uuid = review.uuid
       WHERE review.uuid = $1::uuid
       FOR UPDATE OF review, external`,
      [reviewId],
    );
    const existingReview = existingResult.rows[0];
    if (!existingReview) {
      return { transaction: 'rollback', value: { outcome: 'not_found' } };
    }

    if (!existingReview.external_feedback_uuid) {
      return { transaction: 'rollback', value: { outcome: 'invalid_data' } };
    }

    const correctionResult = managerCorrectionSchema.safeParse({
      correctionId: randomUUID(),
      reviewUuid: reviewId,
      sourceRunId: null,
      originalAiType: null,
      correctedType: triageType,
      managerId,
      occurredAt: new Date().toISOString(),
    });
    if (!correctionResult.success) {
      return { transaction: 'rollback', value: { outcome: 'invalid_data' } };
    }
    const correction = correctionResult.data;
    const correctionEventResult = await client.query<{ uuid: string }>(
      `INSERT INTO feedback_timeline_events (
         external_feedback_uuid,
         step,
         event_payload
       )
       VALUES ($1::uuid, 'manager_correction', $2::jsonb)`,
      [existingReview.external_feedback_uuid, JSON.stringify(correction)],
    );
    if (!correctionEventResult.rows[0]?.uuid) {
      throw new Error('Google review manager correction insert returned no event');
    }

    const updatedResult = await client.query<AdminGoogleBusinessReviewRecord>(
      `SELECT
         ${GOOGLE_REVIEW_PROJECTION}
       FROM google_business_reviews review
       ${UNIQUE_REVIEWER_IDENTITY_JOIN}
       JOIN external_feedback external
         ON external.google_business_review_uuid = review.uuid
       ${LATEST_MANAGER_CORRECTION_JOIN}
       ${LATEST_REPLY_JOIN}
       WHERE review.uuid = $1::uuid
       LIMIT 1`,
      [reviewId],
    );
    const updatedReview = updatedResult.rows[0];
    if (!updatedReview) {
      throw new Error('Google review triage read-back returned no review');
    }

    return {
      transaction: 'commit',
      value: {
        outcome: 'updated',
        review: updatedReview,
      },
    };
  });
};
