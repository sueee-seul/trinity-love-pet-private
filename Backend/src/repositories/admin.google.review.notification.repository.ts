import { pool } from '../config/database.js';
import {
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  GOOGLE_REVIEW_NOTIFICATION_SETTING,
  GOOGLE_REVIEW_RECEIVED_STEP,
} from '../contracts/google.review.notification.contract.js';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  BOOKING_CHANGE_REQUESTED,
  BOOKING_REVIEW_DUE,
  MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
} from '../contracts/booking.notification.contract.js';

// The manager bell: Google Review receipts, "New booking request" notices and "Decision due soon"
// reminders, all assigned to the manager in `notification.assignee_uuid`.

/** The booking notices the bell lists, by `notification.notification_setting`. */
export const BELL_BOOKING_SETTINGS: readonly string[] = [
  MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
  BOOKING_REVIEW_DUE,
  BOOKING_CHANGE_REQUESTED,
];

export interface GoogleReviewNotificationCursor {
  createdAt: Date;
  uuid: string;
}

interface ManagerNotificationBase {
  uuid: string;
  created_at: Date;
  read_at: Date | null;
}

export interface GoogleReviewNotificationRecord extends ManagerNotificationBase {
  category: typeof GOOGLE_REVIEW_NOTIFICATION_CATEGORY;
  review_uuid: string;
  reviewer_display_name: string | null;
  rating: number;
}

export interface BookingRequestNotificationRecord extends ManagerNotificationBase {
  category: typeof BOOKING_NOTIFICATION_CATEGORY;
  /** Which booking notice: a new request, or a review deadline coming up. */
  notification_setting: string;
  booking_uuid: string;
  summary_content: string | null;
}

export type ManagerNotificationRecord =
  GoogleReviewNotificationRecord | BookingRequestNotificationRecord;

export interface GoogleReviewNotificationPageRecord {
  items: ManagerNotificationRecord[];
  unreadCount: number;
  hasMore: boolean;
}

export interface UpdatedGoogleReviewNotificationRecord {
  uuid: string;
  read_at: Date;
}

/** One row of the union below; each branch fills only its own columns. */
interface ManagerNotificationRow extends ManagerNotificationBase {
  category: string;
  review_uuid: string | null;
  reviewer_display_name: string | null;
  rating: number | null;
  booking_uuid: string | null;
  summary_content: string | null;
  notification_setting: string | null;
}

const GOOGLE_LOCATION_ID = 'mock-pethouse-location';

const notificationEligibilityCte = `
  WITH eligible AS (
    SELECT
      notification.uuid,
      notification.created_at,
      notification.read_at,
      notification.category,
      review.uuid::text AS review_uuid,
      review.reviewer_display_name,
      review.rating,
      NULL::text AS booking_uuid,
      NULL::text AS summary_content,
      NULL::text AS notification_setting
    FROM notification
    JOIN feedback_timeline_events event
      ON event.uuid = notification.feedback_timeline_event_uuid
     AND event.step = $4
    JOIN external_feedback external
      ON external.uuid = event.external_feedback_uuid
    JOIN google_business_reviews review
      ON review.uuid = external.google_business_review_uuid
    JOIN google_business_locations location
      ON location.uuid = review.google_business_location_uuid
    WHERE notification.assignee_uuid = $1::uuid
      AND notification.notification_setting = $2
      AND notification.category = $3
      AND location.google_location_id = $5
      AND review.source_deleted_at IS NULL
    UNION ALL
    SELECT
      notification.uuid,
      notification.created_at,
      notification.read_at,
      notification.category,
      NULL::text,
      NULL::text,
      NULL::smallint,
      notification.booking_uuid::text,
      notification.summary_content,
      notification.notification_setting
    FROM notification
    WHERE notification.assignee_uuid = $1::uuid
      AND notification.category = $6
      AND notification.notification_setting = ANY($7::text[])
      AND notification.booking_uuid IS NOT NULL
  )`;

const listNotificationsQuery = `${notificationEligibilityCte}
  SELECT
    page.uuid::text AS uuid,
    page.category,
    page.review_uuid,
    page.reviewer_display_name,
    page.rating,
    page.booking_uuid,
    page.summary_content,
    page.notification_setting,
    page.created_at,
    page.read_at
  FROM (
    SELECT *
    FROM eligible
    WHERE ($8::timestamptz IS NULL OR (created_at, uuid) < ($8::timestamptz, $9::uuid))
    ORDER BY created_at DESC, uuid DESC
    LIMIT $10
  ) page
  ORDER BY page.created_at DESC, page.uuid DESC`;

const countUnreadQuery = `${notificationEligibilityCte}
  SELECT COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread_count
  FROM eligible`;

const SCOPE_PARAMETER_COUNT = 7;

const getNotificationScopeValues = (
  managerUuid: string,
  cursor: GoogleReviewNotificationCursor | null,
): (string | readonly string[] | number | Date | null)[] => [
  managerUuid,
  GOOGLE_REVIEW_NOTIFICATION_SETTING,
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  GOOGLE_REVIEW_RECEIVED_STEP,
  GOOGLE_LOCATION_ID,
  BOOKING_NOTIFICATION_CATEGORY,
  [...BELL_BOOKING_SETTINGS],
  cursor?.createdAt ?? null,
  cursor?.uuid ?? null,
];

// Each branch of the union guarantees its own columns; a row that fits neither is dropped rather
// than shown half empty.
const toManagerNotificationRecord = (row: ManagerNotificationRow): ManagerNotificationRecord[] => {
  const base = { uuid: row.uuid, created_at: row.created_at, read_at: row.read_at };
  if (
    row.category === GOOGLE_REVIEW_NOTIFICATION_CATEGORY &&
    row.review_uuid !== null &&
    row.rating !== null
  ) {
    return [
      {
        ...base,
        category: GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
        review_uuid: row.review_uuid,
        reviewer_display_name: row.reviewer_display_name,
        rating: row.rating,
      },
    ];
  }
  if (
    row.category === BOOKING_NOTIFICATION_CATEGORY &&
    row.booking_uuid !== null &&
    row.notification_setting !== null
  ) {
    return [
      {
        ...base,
        category: BOOKING_NOTIFICATION_CATEGORY,
        notification_setting: row.notification_setting,
        booking_uuid: row.booking_uuid,
        summary_content: row.summary_content,
      },
    ];
  }
  return [];
};

export const findManagerGoogleReviewNotifications = async (
  managerUuid: string,
  limit: number,
  cursor: GoogleReviewNotificationCursor | null,
): Promise<GoogleReviewNotificationPageRecord> => {
  const scopeValues = getNotificationScopeValues(managerUuid, cursor);
  const [countResult, pageResult] = await Promise.all([
    pool.query<{ unread_count: number }>(
      countUnreadQuery,
      scopeValues.slice(0, SCOPE_PARAMETER_COUNT),
    ),
    pool.query<ManagerNotificationRow>(listNotificationsQuery, [...scopeValues, limit + 1]),
  ]);

  const hasMore = pageResult.rows.length > limit;
  const pageRows = hasMore ? pageResult.rows.slice(0, limit) : pageResult.rows;
  return {
    items: pageRows.flatMap(toManagerNotificationRecord),
    unreadCount: countResult.rows[0]?.unread_count ?? 0,
    hasMore,
  };
};

/** The two kinds of manager notice, as SQL whose four values start at parameter `first`. */
const managerNotificationKindFilter = (first: number): string => `
  ((notification_setting = $${first} AND category = $${first + 1})
    OR (notification_setting = ANY($${first + 2}::text[]) AND category = $${first + 3}))`;

const managerNotificationKindValues = (): (string | string[])[] => [
  GOOGLE_REVIEW_NOTIFICATION_SETTING,
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  [...BELL_BOOKING_SETTINGS],
  BOOKING_NOTIFICATION_CATEGORY,
];

export const markManagerGoogleReviewNotificationRead = async (
  notificationUuid: string,
  managerUuid: string,
): Promise<UpdatedGoogleReviewNotificationRecord | null> => {
  const result = await pool.query<UpdatedGoogleReviewNotificationRecord>(
    `UPDATE notification
     SET read_at = COALESCE(read_at, now())
     WHERE uuid = $1::uuid
       AND assignee_uuid = $2::uuid
       AND ${managerNotificationKindFilter(3)}
     RETURNING uuid::text AS uuid, read_at`,
    [notificationUuid, managerUuid, ...managerNotificationKindValues()],
  );

  return result.rows[0] ?? null;
};

export const markAllManagerGoogleReviewNotificationsRead = async (
  managerUuid: string,
): Promise<UpdatedGoogleReviewNotificationRecord[]> => {
  const result = await pool.query<UpdatedGoogleReviewNotificationRecord>(
    `UPDATE notification
     SET read_at = now()
     WHERE assignee_uuid = $1::uuid
       AND ${managerNotificationKindFilter(2)}
       AND read_at IS NULL
     RETURNING uuid::text AS uuid, read_at`,
    [managerUuid, ...managerNotificationKindValues()],
  );

  return result.rows;
};
