import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import type {
  AssignFeedbackRecordsResult,
  DeleteFeedbackRecordResult,
  MarkFeedbackRecordsAsReadResult,
} from './admin.feedback.repository.types.js';
import { lockAndVerifyFeedbackRecords } from './feedback.locking.js';

export const deleteFeedbackRecord = async (
  feedbackUuid: string,
): Promise<DeleteFeedbackRecordResult> => {
  return withDatabaseTransaction<DeleteFeedbackRecordResult>(async (client) => {
    const existingResult = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid
       FROM feedback
       WHERE uuid = $1::uuid
       FOR UPDATE`,
      [feedbackUuid],
    );

    if (!existingResult.rows[0]) {
      return { transaction: 'rollback', value: { deletedUuid: null } };
    }

    await client.query('DELETE FROM notification WHERE feedback_uuid = $1::uuid', [feedbackUuid]);

    const deleteResult = await client.query<{ uuid: string }>(
      `DELETE FROM feedback
       WHERE uuid = $1::uuid
       RETURNING uuid::text AS uuid`,
      [feedbackUuid],
    );
    const deletedUuid = deleteResult.rows[0]?.uuid;

    if (!deletedUuid) {
      throw new Error('Feedback deletion returned no UUID');
    }

    return { transaction: 'commit', value: { deletedUuid } };
  });
};

export const markFeedbackRecordsAsRead = async (
  feedbackUuids: string[],
): Promise<MarkFeedbackRecordsAsReadResult> => {
  const uniqueUuids = [...new Set(feedbackUuids)];
  if (uniqueUuids.length === 0) {
    return { updatedUuids: [], missingUuids: [] };
  }

  return withDatabaseTransaction<MarkFeedbackRecordsAsReadResult>(async (client) => {
    const { missingUuids } = await lockAndVerifyFeedbackRecords(client, uniqueUuids);

    if (missingUuids.length > 0) {
      return {
        transaction: 'rollback',
        value: { updatedUuids: [], missingUuids },
      };
    }

    const updateResult = await client.query<{ uuid: string }>(
      `UPDATE feedback
       SET is_read = true,
           updated_at = now()
       WHERE uuid = ANY($1::uuid[])
       RETURNING uuid::text AS uuid`,
      [uniqueUuids],
    );

    if (updateResult.rows.length !== uniqueUuids.length) {
      throw new Error('Feedback read-state update returned an unexpected row count');
    }

    return {
      transaction: 'commit',
      value: { updatedUuids: uniqueUuids, missingUuids: [] },
    };
  });
};

export const assignFeedbackRecords = async (
  feedbackUuids: string[],
  assigneeUuid: string,
): Promise<AssignFeedbackRecordsResult> => {
  const uniqueUuids = [...new Set(feedbackUuids)];
  if (uniqueUuids.length === 0) {
    return { updatedUuids: [], missingUuids: [], invalidAssignee: false };
  }

  return withDatabaseTransaction<AssignFeedbackRecordsResult>(async (client) => {
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
        value: { updatedUuids: [], missingUuids: [], invalidAssignee: true },
      };
    }

    const { missingUuids } = await lockAndVerifyFeedbackRecords(client, uniqueUuids);

    if (missingUuids.length > 0) {
      return {
        transaction: 'rollback',
        value: { updatedUuids: [], missingUuids, invalidAssignee: false },
      };
    }

    const updateResult = await client.query<{ uuid: string }>(
      `UPDATE feedback
       SET updated_at = now()
       WHERE uuid = ANY($1::uuid[])
       RETURNING uuid::text AS uuid`,
      [uniqueUuids],
    );

    if (updateResult.rows.length !== uniqueUuids.length) {
      throw new Error('Feedback assignment update returned an unexpected row count');
    }

    await client.query(
      `INSERT INTO feedback_timeline_events (
         feedback_uuid,
         step,
         employees_uuid,
         event_payload
       )
       SELECT feedback.uuid, 'assigned', $2::uuid, '{}'::jsonb
       FROM feedback
       WHERE feedback.uuid = ANY($1::uuid[])
       ON CONFLICT (feedback_uuid, step)
       DO UPDATE SET
         employees_uuid = EXCLUDED.employees_uuid,
         event_payload = EXCLUDED.event_payload,
         created_at = now()`,
      [uniqueUuids, assigneeUuid],
    );

    return {
      transaction: 'commit',
      value: { updatedUuids: uniqueUuids, missingUuids: [], invalidAssignee: false },
    };
  });
};
