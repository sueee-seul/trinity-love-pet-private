import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import { GOOGLE_REVIEW_TRIAGE_TYPES } from '../contracts/google.review.ai.contract.js';
import { managerCorrectionSchema } from '../contracts/google.review.manager.correction.contract.js';
import type { AssignGoogleReviewRecordsResult } from './admin.google.review.repository.types.js';

const resolveEffectiveTriageType = (row: { manager_correction: unknown }): string | null => {
  const correction = managerCorrectionSchema.safeParse(row.manager_correction);
  return correction.success ? correction.data.correctedType : null;
};

/**
 * Assigns already-triaged Google reviews in one transaction. The public
 * repository barrel preserves this function's existing import path.
 */
export const assignGoogleReviewRecords = async (
  reviewUuids: string[],
  assigneeUuid: string,
): Promise<AssignGoogleReviewRecordsResult> => {
  const uniqueUuids = [...new Set(reviewUuids)];
  if (uniqueUuids.length === 0) {
    return { updatedUuids: [], missingUuids: [], invalidAssignee: false };
  }

  return withDatabaseTransaction<AssignGoogleReviewRecordsResult>(async (client) => {
    const assigneeResult = await client.query<{ uuid: string }>(
      `SELECT users_uuid::text AS uuid
       FROM employees
       WHERE users_uuid = $1::uuid
       FOR SHARE`,
      [assigneeUuid],
    );

    if (!assigneeResult.rows[0]) {
      return {
        transaction: 'rollback',
        value: {
          updatedUuids: [],
          missingUuids: [],
          invalidAssignee: true,
        },
      };
    }

    const existingReviewsResult = await client.query<{
      uuid: string;
      manager_correction: unknown;
    }>(
      `SELECT review.uuid::text AS uuid,
              latest_manager_correction.event_payload AS manager_correction
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
       WHERE review.uuid = ANY($1::uuid[])
       FOR UPDATE OF review`,
      [uniqueUuids],
    );
    const existingReviewUuids = new Set(existingReviewsResult.rows.map((row) => row.uuid));
    const missingUuids = uniqueUuids.filter((uuid) => !existingReviewUuids.has(uuid));
    const undecidedUuids = existingReviewsResult.rows
      .filter(
        (row) =>
          !GOOGLE_REVIEW_TRIAGE_TYPES.includes(
            resolveEffectiveTriageType(row) as (typeof GOOGLE_REVIEW_TRIAGE_TYPES)[number],
          ),
      )
      .map((row) => row.uuid);

    if (missingUuids.length > 0 || undecidedUuids.length > 0) {
      const value = { updatedUuids: [], missingUuids, invalidAssignee: false };
      if (undecidedUuids.length > 0) {
        return {
          transaction: 'rollback',
          value: { ...value, undecidedUuids },
        };
      }
      return {
        transaction: 'rollback',
        value,
      };
    }

    const assignmentResult = await client.query<{ uuid: string }>(
      `INSERT INTO external_feedback (
         google_business_review_uuid,
         assigned_employee_uuid,
         assigned_at,
         updated_at
       )
       SELECT selected.uuid,
              $2::uuid,
              now(),
              now()
       FROM unnest($1::uuid[]) AS selected(uuid)
       ON CONFLICT (google_business_review_uuid)
       DO UPDATE SET
         assigned_employee_uuid = EXCLUDED.assigned_employee_uuid,
         assigned_at = EXCLUDED.assigned_at,
         updated_at = now()
       RETURNING google_business_review_uuid::text AS uuid`,
      [uniqueUuids, assigneeUuid],
    );

    if (assignmentResult.rows.length !== uniqueUuids.length) {
      throw new Error('Google review assignment returned an unexpected row count');
    }

    return {
      transaction: 'commit',
      value: { updatedUuids: uniqueUuids, missingUuids: [], invalidAssignee: false },
    };
  });
};
