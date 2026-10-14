import { AppError } from '../common/middlewares/error.middleware.js';
import {
  PARENT_BOOKING_NOTIFICATION_KINDS,
  type ParentBookingNotificationKind,
  type ParentNotification,
  type ParentNotificationList,
  type ParentNotificationListQuery,
  type ParentNotificationRead,
  type ParentNotificationsReadAll,
  type ParentNotificationsReadAllInput,
} from '../contracts/booking.notification.contract.js';
import {
  listParentNotifications,
  markAllParentNotificationsRead,
  markParentNotificationRead,
  type ParentNotificationRow,
} from '../repositories/petparent.notification.repository.js';
import { noticeFactsOf } from './booking.notification.facts.js';
import { PARENT_NOTIFICATION_TITLES } from './booking.notification.messages.js';

// The signed-in parent's bell: what arrived, and what they have read.

const isParentKind = (value: string): value is ParentBookingNotificationKind =>
  (PARENT_BOOKING_NOTIFICATION_KINDS as readonly string[]).includes(value);

// The query already limits rows to these kinds; the guard keeps the type honest if a new kind is
// stored before this list names it.
const toParentNotification = (row: ParentNotificationRow): ParentNotification[] =>
  isParentKind(row.kind)
    ? [
        {
          id: row.id,
          kind: row.kind,
          title: PARENT_NOTIFICATION_TITLES[row.kind],
          body: row.body ?? '',
          facts: noticeFactsOf(row.kind, row.body ?? ''),
          createdAt: row.created_at.toISOString(),
          readAt: row.read_at?.toISOString() ?? null,
        },
      ]
    : [];

export const getParentNotifications = async (
  ownerId: string,
  query: ParentNotificationListQuery,
): Promise<ParentNotificationList> => {
  const page = await listParentNotifications(ownerId, query.limit);
  return { items: page.rows.flatMap(toParentNotification), unreadCount: page.unreadCount };
};

/** Another parent's notice gets the same 404 as one that does not exist. */
export const readParentNotification = async (
  ownerId: string,
  notificationId: string,
): Promise<ParentNotificationRead> => {
  const row = await markParentNotificationRead(ownerId, notificationId);
  if (!row) {
    throw new AppError('Notification not found', 'NOTIFICATION_NOT_FOUND', 404);
  }
  return { id: row.id, readAt: row.read_at.toISOString() };
};

export const readAllParentNotifications = async (
  ownerId: string,
  input: ParentNotificationsReadAllInput,
): Promise<ParentNotificationsReadAll> => {
  const rows = await markAllParentNotificationsRead(
    ownerId,
    input.through ? new Date(input.through) : null,
  );
  return {
    updatedIds: rows.map((row) => row.id),
    readAt: rows[0]?.read_at.toISOString() ?? null,
  };
};
