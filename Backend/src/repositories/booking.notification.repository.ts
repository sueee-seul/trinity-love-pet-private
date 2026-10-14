import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
  type BookingNotificationSetting,
  type ParentBookingNotificationKind,
} from '../contracts/booking.notification.contract.js';
import type { SqlRunner } from './booking.capacity.repository.js';

// Writes booking notices into the existing `notification` table. Each write is one statement, so
// it commits on its own through the pool, or joins the caller's transaction through its client.

/** The pool, or a client inside the caller's transaction: both run one statement the same way. */
type NoticeWriter = Pick<PoolClient, 'query'>;

/** Who and when a notice is about: the pets on the request and their stay. */
export interface BookingNoticeSubject {
  petNames: readonly string[];
  dropOffTime: Date | null;
  pickUpTime: Date | null;
}

export interface ParentNoticeDraft {
  ownerId: string;
  bookingId: string;
  kind: ParentBookingNotificationKind;
  body: string;
  /** The checkout receipt: its email ends with the terms the booking agreed to. */
  withAgreedTerms?: boolean;
  /** The language the body is written in; the email's subject and footer follow it. English if absent. */
  locale?: 'en' | 'zh';
}

export interface ManagerNoticeDraft {
  bookingId: string;
  body: string;
}

/** One notice and its owner link, in one statement so neither exists without the other. */
const insertParentNotice = async (
  writer: NoticeWriter,
  draft: ParentNoticeDraft,
): Promise<void> => {
  await writer.query(
    `WITH created AS (
       INSERT INTO notification (notification_setting, category, booking_uuid, summary_content)
       VALUES ($2, $3, $4::uuid, $5)
       RETURNING uuid
     )
     INSERT INTO pet_owners_notification (pet_owners_uuid, notification_uuid)
     SELECT $1::uuid, created.uuid
     FROM created`,
    [draft.ownerId, draft.kind, BOOKING_NOTIFICATION_CATEGORY, draft.bookingId, draft.body],
  );
};

/**
 * One notice per active manager, the same set of managers the Google Review notices reach
 * (google.review.notification.repository.ts). Returns how many were written; none when no manager
 * is active.
 */
export const recordManagerRequestNotices = async (draft: ManagerNoticeDraft): Promise<number> => {
  const result = await pool.query(
    `INSERT INTO notification (
       notification_setting, category, assignee_uuid, booking_uuid, summary_content
     )
     SELECT $1, $2, e.users_uuid, $3::uuid, $4
     FROM employees e
     JOIN users u ON u.uuid = e.users_uuid
     WHERE u.is_employee = TRUE
       AND e.staff_role = 'manager'
       AND e.staff_status = 'active'`,
    [
      MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
      BOOKING_NOTIFICATION_CATEGORY,
      draft.bookingId,
      draft.body,
    ],
  );
  return result.rowCount ?? 0;
};

/** A parent notice on its own, for an event that has already committed. */
export const recordParentNotice = (draft: ParentNoticeDraft): Promise<void> =>
  insertParentNotice(pool, draft);

const NOTICE_SAVEPOINT = 'booking_parent_notice';

/**
 * Writes a parent notice inside the caller's open transaction without putting that transaction at
 * risk: a failed insert is rolled back to a savepoint, so the decision it describes still commits.
 * Returns whether the notice was written. The failure is logged here, with no personal details,
 * because the caller only learns that the notice is missing.
 */
export const insertParentNoticeWithinTransaction = async (
  client: PoolClient,
  draft: ParentNoticeDraft,
): Promise<boolean> => {
  await client.query(`SAVEPOINT ${NOTICE_SAVEPOINT}`);
  try {
    await insertParentNotice(client, draft);
  } catch (error: unknown) {
    await client.query(`ROLLBACK TO SAVEPOINT ${NOTICE_SAVEPOINT}`);
    console.error('[notifications] parent notice was not written', {
      kind: draft.kind,
      bookingId: draft.bookingId,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
  await client.query(`RELEASE SAVEPOINT ${NOTICE_SAVEPOINT}`);
  return true;
};

export interface BookingRequestSubject extends BookingNoticeSubject {
  ownerId: string;
}

interface BookingRequestSubjectRow {
  owner_id: string;
  pet_names: string[];
  drop_off_time: Date | null;
  pick_up_time: Date | null;
}

/** Who a new request belongs to, its pets in the order they were added, and its whole stay. */
export const findBookingRequestSubject = async (
  bookingId: string,
): Promise<BookingRequestSubject | null> => {
  const result = await pool.query<BookingRequestSubjectRow>(
    `SELECT b.pet_owners_uuid::text AS owner_id,
            array_agg(p.name ORDER BY bp.created_at, bp.uuid) AS pet_names,
            min(bp.drop_off_time) AS drop_off_time,
            max(bp.pick_up_time) AS pick_up_time
     FROM bookings b
     JOIN booking_pets bp ON bp.bookings_uuid = b.uuid
     JOIN pets p ON p.uuid = bp.pet_uuid
     WHERE b.uuid = $1::uuid
     GROUP BY b.pet_owners_uuid`,
    [bookingId],
  );
  const row = result.rows[0];
  return row
    ? {
        ownerId: row.owner_id,
        petNames: row.pet_names,
        dropOffTime: row.drop_off_time,
        pickUpTime: row.pick_up_time,
      }
    : null;
};

/**
 * Flags for managers from the booking jobs and the desk: one row per active manager, linked by
 * booking_uuid. Every parameter is cast: $1 is both a selected value and a comparison,
 * and Postgres refuses to guess one type for both.
 */

export interface ManagerNotice {
  bookingId: string;
  setting: BookingNotificationSetting;
  summary: string;
}

const ACTIVE_MANAGERS = `
    FROM employees e
    JOIN users u ON u.uuid = e.users_uuid
   WHERE u.is_employee = TRUE
     AND e.staff_role = 'manager'
     AND e.staff_status = 'active'`;

const INSERT_NOTICE = `
  INSERT INTO notification (notification_setting, category, assignee_uuid, booking_uuid, summary_content)
  SELECT $1::text, $2::text, e.users_uuid, $3::uuid, $4::text
  ${ACTIVE_MANAGERS}`;

/** A flag raised once per booking: nothing is added when this booking already has it. */
const INSERT_FLAG_ONCE = `${INSERT_NOTICE}
     AND NOT EXISTS (
       SELECT 1 FROM notification n
        WHERE n.booking_uuid = $3::uuid AND n.notification_setting = $1::text
     )`;

const valuesOf = (notice: ManagerNotice): unknown[] => [
  notice.setting,
  BOOKING_NOTIFICATION_CATEGORY,
  notice.bookingId,
  notice.summary,
];

/** Something to act on, raised once per booking (a failed hold, an unrecorded arrival). */
export const insertManagerFlag = async (
  runner: SqlRunner,
  notice: ManagerNotice,
): Promise<void> => {
  await runner.query(INSERT_FLAG_ONCE, valuesOf(notice));
};

/** A record of something staff did, kept every time (e.g. a stay moved without a charge). */
export const insertManagerNotice = async (
  runner: SqlRunner,
  notice: ManagerNotice,
): Promise<void> => {
  await runner.query(INSERT_NOTICE, valuesOf(notice));
};

/** Only the owner attached to this booking may receive its transactional email. */
export const findBookingEmailRecipient = async (
  bookingId: string,
  ownerId: string,
): Promise<string | null> => {
  const result = await pool.query<{ email: string }>(
    `SELECT u.email FROM bookings b JOIN users u ON u.uuid = b.pet_owners_uuid
      WHERE b.uuid = $1::uuid AND b.pet_owners_uuid = $2::uuid`,
    [bookingId, ownerId],
  );
  return result.rows[0]?.email ?? null;
};
