import { pool } from '../config/database.js';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  PARENT_BOOKING_NOTIFICATION_KINDS,
} from '../contracts/booking.notification.contract.js';

// A pet parent's own booking notices. Ownership is part of every statement through
// `pet_owners_notification`, so another parent's notice reads and updates exactly like an id that
// does not exist, and manager notices (which have no owner link) are never reachable from here.

const OWNED_NOTICES = `
  FROM notification n
  JOIN pet_owners_notification pon ON pon.notification_uuid = n.uuid
  WHERE pon.pet_owners_uuid = $1::uuid
    AND n.category = $2
    AND n.notification_setting = ANY($3::text[])`;

const ownedScope = (ownerId: string): [string, string, string[]] => [
  ownerId,
  BOOKING_NOTIFICATION_CATEGORY,
  [...PARENT_BOOKING_NOTIFICATION_KINDS],
];

export interface ParentNotificationRow {
  id: string;
  kind: string;
  body: string | null;
  created_at: Date;
  read_at: Date | null;
}

export interface ParentNotificationPageRows {
  rows: ParentNotificationRow[];
  unreadCount: number;
}

export interface ReadNotificationRow {
  id: string;
  read_at: Date;
}

/** Newest first, with the count of every unread notice the owner has. */
export const listParentNotifications = async (
  ownerId: string,
  limit: number,
): Promise<ParentNotificationPageRows> => {
  const scope = ownedScope(ownerId);
  const [page, unread] = await Promise.all([
    pool.query<ParentNotificationRow>(
      `SELECT n.uuid::text AS id,
              n.notification_setting AS kind,
              n.summary_content AS body,
              n.created_at,
              n.read_at
       ${OWNED_NOTICES}
       ORDER BY n.created_at DESC, n.uuid DESC
       LIMIT $4`,
      [...scope, limit],
    ),
    pool.query<{ unread_count: number }>(
      `SELECT COUNT(*)::int AS unread_count ${OWNED_NOTICES} AND n.read_at IS NULL`,
      scope,
    ),
  ]);
  return { rows: page.rows, unreadCount: unread.rows[0]?.unread_count ?? 0 };
};

/** Marks one notice read, keeping the first read time. Null when the owner has no such notice. */
export const markParentNotificationRead = async (
  ownerId: string,
  notificationId: string,
): Promise<ReadNotificationRow | null> => {
  const result = await pool.query<ReadNotificationRow>(
    `UPDATE notification n
     SET read_at = COALESCE(n.read_at, now())
     FROM pet_owners_notification pon
     WHERE n.uuid = $4::uuid
       AND pon.notification_uuid = n.uuid
       AND pon.pet_owners_uuid = $1::uuid
       AND n.category = $2
       AND n.notification_setting = ANY($3::text[])
     RETURNING n.uuid::text AS id, n.read_at`,
    [...ownedScope(ownerId), notificationId],
  );
  return result.rows[0] ?? null;
};

/**
 * Marks the owner's unread notices read, up to `through` when given. The bell sends the newest
 * notice it showed, so one that arrives in the meantime stays unread. `created_at` is compared at
 * millisecond precision because that is all a JavaScript date carries back.
 */
export const markAllParentNotificationsRead = async (
  ownerId: string,
  through: Date | null,
): Promise<ReadNotificationRow[]> => {
  const result = await pool.query<ReadNotificationRow>(
    `UPDATE notification n
     SET read_at = now()
     FROM pet_owners_notification pon
     WHERE pon.notification_uuid = n.uuid
       AND pon.pet_owners_uuid = $1::uuid
       AND n.category = $2
       AND n.notification_setting = ANY($3::text[])
       AND n.read_at IS NULL
       AND ($4::timestamptz IS NULL OR date_trunc('milliseconds', n.created_at) <= $4::timestamptz)
     RETURNING n.uuid::text AS id, n.read_at`,
    [...ownedScope(ownerId), through],
  );
  return result.rows;
};
