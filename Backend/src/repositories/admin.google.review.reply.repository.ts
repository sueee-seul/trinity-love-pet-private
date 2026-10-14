import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import {
  GOOGLE_REVIEW_PROJECTION,
  LATEST_MANAGER_CORRECTION_JOIN,
  LATEST_REPLY_JOIN,
  UNIQUE_REVIEWER_IDENTITY_JOIN,
} from './admin.google.review.sql.js';
import type {
  AdminGoogleBusinessReviewRecord,
  AdminGoogleReviewActor,
  UpdateMockGoogleBusinessReviewReplyResult,
} from './admin.google.review.repository.types.js';

/**
 * Persists a simulated reply to a mock Google review.
 * Transactional boundaries ensure the reply is only recorded if the actor possesses the correct role and assignment.
 */
export const updateMockGoogleBusinessReviewReply = async (
  reviewId: string,
  replyBody: string,
  actor: AdminGoogleReviewActor,
): Promise<UpdateMockGoogleBusinessReviewReplyResult> => {
  return withDatabaseTransaction<UpdateMockGoogleBusinessReviewReplyResult>(async (client) => {
    const existingResult = await client.query<{
      id: string;
      data_origin: 'mock' | 'live';
      reviewer_email: string | null;
      external_feedback_uuid: string | null;
      latest_draft_uuid: string | null;
    }>(
      `SELECT
         review.uuid::text AS id,
         review.data_origin,
         reviewer_identity.email AS reviewer_email,
         external.uuid::text AS external_feedback_uuid,
         latest_draft.uuid::text AS latest_draft_uuid
       FROM google_business_reviews review
       ${UNIQUE_REVIEWER_IDENTITY_JOIN}
       LEFT JOIN external_feedback external
         ON external.google_business_review_uuid = review.uuid
       LEFT JOIN LATERAL (
         SELECT reply.uuid
         FROM external_feedback_replies reply
         WHERE reply.external_feedback_uuid = external.uuid
           AND reply.reply_status = 'draft'
         ORDER BY reply.updated_at DESC, reply.created_at DESC, reply.uuid DESC
         LIMIT 1
       ) latest_draft ON true
       WHERE review.uuid = $1::uuid
         ${actor.role === 'staff' ? 'AND external.assigned_employee_uuid = $2::uuid' : ''}
       FOR UPDATE OF review`,
      actor.role === 'staff' ? [reviewId, actor.id] : [reviewId],
    );
    const existingReview = existingResult.rows[0];

    if (!existingReview) {
      return { transaction: 'rollback', value: { outcome: 'not_found' } };
    }
    if (existingReview.data_origin !== 'mock') {
      return { transaction: 'rollback', value: { outcome: 'not_mock' } };
    }
    if (!existingReview.reviewer_email?.trim()) {
      return { transaction: 'rollback', value: { outcome: 'recipient_unavailable' } };
    }

    let externalFeedbackUuid: string | null = existingReview.external_feedback_uuid;
    if (!externalFeedbackUuid && actor.role === 'manager') {
      const feedbackInsertResult = await client.query<{ uuid: string }>(
        `INSERT INTO external_feedback (google_business_review_uuid)
         VALUES ($1::uuid)
         ON CONFLICT (google_business_review_uuid) DO NOTHING
         RETURNING uuid::text AS uuid`,
        [reviewId],
      );
      externalFeedbackUuid = feedbackInsertResult.rows[0]?.uuid ?? null;

      if (!externalFeedbackUuid) {
        const feedbackResult = await client.query<{ uuid: string }>(
          `SELECT uuid::text AS uuid
           FROM external_feedback
           WHERE google_business_review_uuid = $1::uuid
           FOR UPDATE`,
          [reviewId],
        );
        externalFeedbackUuid = feedbackResult.rows[0]?.uuid ?? null;
      }
    }

    if (!externalFeedbackUuid) {
      throw new Error('Google review external feedback was not available');
    }

    const replyResult = await client.query<{ uuid: string }>(
      existingReview.latest_draft_uuid
        ? `UPDATE external_feedback_replies
           SET employees_uuid = $2::uuid,
               reply_body = $3,
               reply_status = 'sent',
               sent_at = now(),
               last_error = NULL,
               updated_at = now()
           WHERE uuid = $1::uuid
             AND reply_status = 'draft'
           RETURNING uuid`
        : `INSERT INTO external_feedback_replies (
             external_feedback_uuid,
             employees_uuid,
             reply_body,
             reply_status,
             sent_at
           )
           VALUES ($1::uuid, $2::uuid, $3, 'sent', now())
           RETURNING uuid`,
      existingReview.latest_draft_uuid
        ? [existingReview.latest_draft_uuid, actor.id, replyBody]
        : [externalFeedbackUuid, actor.id, replyBody],
    );
    if (!replyResult.rows[0]) {
      throw new Error('Google review reply insert returned no reply');
    }

    const updatedResult = await client.query<AdminGoogleBusinessReviewRecord>(
      `SELECT
         ${GOOGLE_REVIEW_PROJECTION}
       FROM google_business_reviews review
       ${UNIQUE_REVIEWER_IDENTITY_JOIN}
       LEFT JOIN external_feedback external
         ON external.google_business_review_uuid = review.uuid
       ${LATEST_MANAGER_CORRECTION_JOIN}
       ${LATEST_REPLY_JOIN}
       WHERE review.uuid = $1::uuid
       LIMIT 1`,
      [reviewId],
    );
    const updatedReview = updatedResult.rows[0];
    if (!updatedReview) {
      throw new Error('Google review reply read-back returned no review');
    }

    return {
      transaction: 'commit',
      value: { outcome: 'updated', review: updatedReview },
    };
  });
};
