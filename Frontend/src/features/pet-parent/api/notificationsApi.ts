// The parent bell's endpoints (Backend/src/routes/petparent.notifications.routes.ts). The owner is
// the session's; nothing here names a parent.
import {
  PARENT_NOTIFICATION_KINDS,
  type ParentNoticeFacts,
  type ParentNotification,
  type ParentNotificationList,
  type ParentNotificationRead,
  type ParentNotificationsReadAll,
} from '../types/notifications';
import { request } from './bookingApi';

const NOTIFICATIONS_PATH = '/petparent/notifications';

/** How many notices the bell shows; older ones stay on the server. */
export const NOTIFICATION_PAGE_SIZE = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNotification = (value: unknown): value is ParentNotification =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (PARENT_NOTIFICATION_KINDS as readonly unknown[]).includes(value.kind) &&
  typeof value.title === 'string' &&
  typeof value.body === 'string' &&
  typeof value.createdAt === 'string' &&
  (value.readAt === null || typeof value.readAt === 'string');

/** Facts the page does not recognise are dropped; the notice then reads as a general line. */
const factsOf = (value: unknown): ParentNoticeFacts | null =>
  isRecord(value) && typeof value.template === 'string' ? (value as ParentNoticeFacts) : null;

const isNotificationList = (value: unknown): value is ParentNotificationList =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isNotification) &&
  typeof value.unreadCount === 'number' &&
  Number.isInteger(value.unreadCount) &&
  value.unreadCount >= 0;

/** GET: the newest notices and the count of unread ones. */
export async function fetchNotifications(): Promise<ParentNotificationList> {
  const list = await request<unknown>(`${NOTIFICATIONS_PATH}?limit=${NOTIFICATION_PAGE_SIZE}`);
  if (!isNotificationList(list)) {
    throw new Error('We could not read your notifications.');
  }
  return { ...list, items: list.items.map((item) => ({ ...item, facts: factsOf(item.facts) })) };
}

/** PATCH: one notice read. The first read time is kept. */
export function markNotificationRead(notificationId: string): Promise<ParentNotificationRead> {
  return request<ParentNotificationRead>(
    `${NOTIFICATIONS_PATH}/${encodeURIComponent(notificationId)}/read`,
    { method: 'PATCH' },
  );
}

/**
 * PATCH: every unread notice up to `through`, the newest one the bell showed, so a notice that
 * arrives meanwhile stays unread.
 */
export function markAllNotificationsRead(through: string): Promise<ParentNotificationsReadAll> {
  return request<ParentNotificationsReadAll>(`${NOTIFICATIONS_PATH}/read-all`, {
    method: 'PATCH',
    body: JSON.stringify({ through }),
  });
}
