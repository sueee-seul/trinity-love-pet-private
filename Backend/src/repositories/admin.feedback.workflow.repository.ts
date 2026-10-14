import {
  SUGGESTION_WORKFLOW_STATUSES,
  type FeedbackProgressStep,
  type FeedbackType,
  type SuggestionWorkflowStatus,
} from '../contracts/feedback.contract.js';
import { pool } from '../config/database.js';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import { ADMIN_FEEDBACK_TIMELINE_AGGREGATION } from './admin.feedback.sql.js';
import type {
  AdminFeedbackWorkflowRecord,
  ReplyFeedbackRecordResult,
  WorkflowMutationResult,
} from './admin.feedback.repository.types.js';

export const getAdminFeedbackWorkflowRecord = async (
  feedbackUuid: string,
): Promise<AdminFeedbackWorkflowRecord | null> => {
  const result = await pool.query<AdminFeedbackWorkflowRecord>(
    `SELECT
       f.category,
       f.current_status,${ADMIN_FEEDBACK_TIMELINE_AGGREGATION}
     FROM feedback f
     LEFT JOIN feedback_timeline_events timeline ON timeline.feedback_uuid = f.uuid
     LEFT JOIN users employee_user ON employee_user.uuid = timeline.employees_uuid
     WHERE f.uuid = $1::uuid
     GROUP BY f.uuid
     LIMIT 1`,
    [feedbackUuid],
  );

  return result.rows[0] ?? null;
};

export const replyFeedbackRecord = async (
  feedbackUuid: string,
  actorId: string,
  emailBody: string,
): Promise<ReplyFeedbackRecordResult> => {
  return withDatabaseTransaction<ReplyFeedbackRecordResult>(async (client) => {
    const existingResult = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid
       FROM feedback
       WHERE uuid = $1::uuid
       FOR UPDATE`,
      [feedbackUuid],
    );

    if (!existingResult.rows[0]) {
      return { transaction: 'rollback', value: { repliedUuid: null } };
    }

    await client.query(
      `UPDATE feedback
       SET current_status = 'sent',
           updated_at = now()
       WHERE uuid = $1::uuid`,
      [feedbackUuid],
    );
    await client.query(
      `INSERT INTO feedback_timeline_events (
         feedback_uuid,
         step,
         employees_uuid,
         event_payload
       )
       VALUES ($1::uuid, 'sent', $2::uuid, $3::jsonb)
       ON CONFLICT (feedback_uuid, step)
       DO UPDATE SET
         employees_uuid = EXCLUDED.employees_uuid,
         event_payload = EXCLUDED.event_payload,
         created_at = now()`,
      [feedbackUuid, actorId, JSON.stringify({ actorId, emailBody })],
    );

    return { transaction: 'commit', value: { repliedUuid: feedbackUuid } };
  });
};

export const transitionIssueFeedback = async (
  feedbackUuid: string,
  status: FeedbackProgressStep,
  actorId: string,
  expectedCurrentStatus: FeedbackProgressStep,
): Promise<WorkflowMutationResult> => {
  return withDatabaseTransaction<WorkflowMutationResult>(async (client) => {
    const feedbackResult = await client.query<{
      category: FeedbackType;
      current_status: FeedbackProgressStep | null;
    }>(
      `SELECT category, current_status
       FROM feedback
       WHERE uuid = $1::uuid
       FOR UPDATE`,
      [feedbackUuid],
    );
    const feedback = feedbackResult.rows[0];

    if (!feedback) {
      return { transaction: 'rollback', value: { outcome: 'not_found' } };
    }
    if (feedback.category !== 'Issue') {
      return { transaction: 'rollback', value: { outcome: 'invalid_category' } };
    }
    if (feedback.current_status !== expectedCurrentStatus) {
      return {
        transaction: 'rollback',
        value: { outcome: 'invalid_transition', currentStatus: feedback.current_status },
      };
    }

    await client.query(
      `UPDATE feedback
       SET current_status = $2,
           updated_at = now()
       WHERE uuid = $1::uuid`,
      [feedbackUuid, status],
    );
    await client.query(
      `INSERT INTO feedback_timeline_events (
         feedback_uuid,
         step,
         event_payload
       )
       VALUES ($1::uuid, $2, $3::jsonb)
       ON CONFLICT (feedback_uuid, step)
       DO UPDATE SET
         event_payload = EXCLUDED.event_payload,
         created_at = now()`,
      [feedbackUuid, status, JSON.stringify({ actorId })],
    );

    return { transaction: 'commit', value: { outcome: 'updated' } };
  });
};

export const transitionSuggestionFeedback = async (
  feedbackUuid: string,
  status: SuggestionWorkflowStatus,
  actorId: string,
  expectedCurrentStatus: SuggestionWorkflowStatus,
  eventPayload: Record<string, unknown>,
): Promise<WorkflowMutationResult> => {
  return withDatabaseTransaction<WorkflowMutationResult>(async (client) => {
    const feedbackResult = await client.query<{ category: FeedbackType }>(
      `SELECT category
       FROM feedback
       WHERE uuid = $1::uuid
       FOR UPDATE`,
      [feedbackUuid],
    );
    const feedback = feedbackResult.rows[0];

    if (!feedback) {
      return { transaction: 'rollback', value: { outcome: 'not_found' } };
    }
    if (feedback.category !== 'Suggestion') {
      return { transaction: 'rollback', value: { outcome: 'invalid_category' } };
    }

    const workflowResult = await client.query<{
      step: SuggestionWorkflowStatus;
      event_payload: Record<string, unknown>;
    }>(
      `SELECT step, event_payload
       FROM feedback_timeline_events
       WHERE feedback_uuid = $1::uuid
         AND step = ANY($2::varchar[])
       ORDER BY created_at DESC, step DESC
       LIMIT 1`,
      [feedbackUuid, [...SUGGESTION_WORKFLOW_STATUSES]],
    );
    const currentStatus = workflowResult.rows[0]?.step ?? null;

    if (currentStatus !== expectedCurrentStatus) {
      return {
        transaction: 'rollback',
        value: { outcome: 'invalid_transition', currentStatus },
      };
    }

    await client.query(
      `INSERT INTO feedback_timeline_events (
         feedback_uuid,
         step,
         event_payload
       )
       VALUES ($1::uuid, $2, $3::jsonb)
       ON CONFLICT (feedback_uuid, step)
       DO UPDATE SET
         event_payload = EXCLUDED.event_payload,
         created_at = now()`,
      [feedbackUuid, status, JSON.stringify({ ...eventPayload, actorId })],
    );

    return { transaction: 'commit', value: { outcome: 'updated' } };
  });
};
