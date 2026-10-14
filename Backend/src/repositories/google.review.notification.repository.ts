import type { PoolClient } from 'pg';
import {
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  GOOGLE_REVIEW_NOTIFICATION_SETTING,
  GOOGLE_REVIEW_RECEIVED_STEP,
} from '../contracts/google.review.notification.contract.js';

interface ActiveManagerRow {
  uuid: string;
}

interface TimelineEventRow {
  uuid: string;
}

interface NotificationRow {
  uuid: string;
}

export interface CreateGoogleReviewNotificationInput {
  reviewUuid: string;
  externalFeedbackUuid: string;
  placeSlug: string;
  reviewerName: string;
  rating: number;
}

const getActiveManagerIds = async (client: PoolClient): Promise<string[]> => {
  const result = await client.query<ActiveManagerRow>(
    `SELECT e.users_uuid::text AS uuid
     FROM employees e
     JOIN users u ON u.uuid = e.users_uuid
     WHERE u.is_employee = TRUE
       AND e.staff_role = 'manager'
       AND e.staff_status = 'active'
     ORDER BY e.users_uuid`,
  );

  return result.rows.map((row) => row.uuid);
};

const buildNotificationSummary = (input: CreateGoogleReviewNotificationInput): string =>
  `New review from ${input.reviewerName}: ${input.rating} stars · ${input.placeSlug}`;

/**
 * Persists the manager-facing receipt event and one notification per active manager.
 *
 * @remarks
 * The caller owns the surrounding review transaction. Review refresh events are published only
 * after the transaction has committed.
 */
export const insertGoogleReviewReceiptNotifications = async (
  client: PoolClient,
  input: CreateGoogleReviewNotificationInput,
): Promise<void> => {
  const eventResult = await client.query<TimelineEventRow>(
    `INSERT INTO feedback_timeline_events (
       external_feedback_uuid,
       step,
       event_payload
     )
     VALUES ($1::uuid, $2, $3::jsonb)
     RETURNING uuid::text AS uuid`,
    [
      input.externalFeedbackUuid,
      GOOGLE_REVIEW_RECEIVED_STEP,
      JSON.stringify({ reviewUuid: input.reviewUuid, placeSlug: input.placeSlug }),
    ],
  );
  const eventUuid = eventResult.rows[0]?.uuid;
  if (!eventUuid) {
    throw new Error('Google review receipt event insert returned no UUID');
  }

  const managerIds = await getActiveManagerIds(client);
  if (managerIds.length === 0) {
    return;
  }

  const notificationResult = await client.query<NotificationRow>(
    `INSERT INTO notification (
       notification_setting,
       category,
       assignee_uuid,
       summary_content,
       feedback_timeline_event_uuid
     )
     SELECT $1,
            $2,
            manager_uuid,
            $3,
            $4::uuid
     FROM unnest($5::uuid[]) AS manager_uuid
     RETURNING uuid::text AS uuid`,
    [
      GOOGLE_REVIEW_NOTIFICATION_SETTING,
      GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
      buildNotificationSummary(input),
      eventUuid,
      managerIds,
    ],
  );

  if (notificationResult.rows.length !== managerIds.length) {
    throw new Error('Google review notification insert returned an unexpected row count');
  }
};

/** Removes notifications linked to a mock review before its external feedback is deleted. */
export const deleteGoogleReviewNotifications = async (
  client: PoolClient,
  reviewUuid: string,
): Promise<void> => {
  await client.query(
    `DELETE FROM notification AS notification
     USING feedback_timeline_events AS event,
           external_feedback AS external
     WHERE notification.feedback_timeline_event_uuid = event.uuid
       AND event.external_feedback_uuid = external.uuid
       AND external.google_business_review_uuid = $1::uuid`,
    [reviewUuid],
  );
};
