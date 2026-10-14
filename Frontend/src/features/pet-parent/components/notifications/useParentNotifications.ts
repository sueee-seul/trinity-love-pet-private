import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notificationsApi';
import type { ParentNotification, ParentNotificationList } from '../../types/notifications';

// The parent bell's state. It lives with the header, which stays mounted across the portal's
// pages, so the unread count is loaded once on sign-in and fresh again each time the bell opens.

export type ParentNotificationsStatus = 'loading' | 'ready' | 'error';

/**
 * What went wrong, as a reason the panel words in the reader's language. The server logs the cause
 * of a failed request, so the parent only needs to know which step failed.
 */
export type ParentNotificationsError = 'load' | 'read';

export interface ParentNotifications {
  items: ParentNotification[];
  unreadCount: number;
  status: ParentNotificationsStatus;
  error: ParentNotificationsError | null;
  /** Unread when the bell last opened. They stay marked new while it is open, though now read. */
  newIds: ReadonlySet<string>;
  /** Loads the newest notices and marks the ones shown as read. */
  openBell: () => Promise<void>;
  /** Marks one notice read when the parent follows it, if opening the bell could not. */
  markRead: (notification: ParentNotification) => Promise<void>;
}

const withReadAt = (
  items: ParentNotification[],
  readIds: ReadonlySet<string>,
  readAt: string,
): ParentNotification[] => items.map((item) => (readIds.has(item.id) ? { ...item, readAt } : item));

export function useParentNotifications(): ParentNotifications {
  const [items, setItems] = useState<ParentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<ParentNotificationsStatus>('loading');
  const [error, setError] = useState<ParentNotificationsError | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  // Only the newest load may write the list: an older response arriving late is dropped.
  const latestLoad = useRef(0);

  const showList = useCallback(
    (ticket: number, list: ParentNotificationList): ParentNotificationList | null => {
      if (ticket !== latestLoad.current) return null;
      setItems(list.items);
      setUnreadCount(list.unreadCount);
      setStatus('ready');
      setError(null);
      return list;
    },
    [],
  );

  const showLoadError = useCallback((ticket: number): null => {
    if (ticket === latestLoad.current) {
      setStatus('error');
      setError('load');
    }
    return null;
  }, []);

  // The state is set only in the request's callbacks, once the server has answered.
  const load = useCallback((): Promise<ParentNotificationList | null> => {
    const ticket = ++latestLoad.current;
    return fetchNotifications().then(
      (list) => showList(ticket, list),
      () => showLoadError(ticket),
    );
  }, [showList, showLoadError]);

  const readShown = useCallback(async (list: ParentNotificationList): Promise<void> => {
    setNewIds(new Set(list.items.filter((item) => item.readAt === null).map((item) => item.id)));
    const newest = list.items[0];
    if (!newest || list.unreadCount === 0) return;
    try {
      const result = await markAllNotificationsRead(newest.createdAt);
      const { readAt } = result;
      if (readAt) setItems((current) => withReadAt(current, new Set(result.updatedIds), readAt));
      setUnreadCount((count) => Math.max(0, count - result.updatedIds.length));
    } catch {
      setError('read');
    }
  }, []);

  const openBell = useCallback(async (): Promise<void> => {
    const list = await load();
    if (list) await readShown(list);
  }, [load, readShown]);

  const markRead = useCallback(async (notification: ParentNotification): Promise<void> => {
    if (notification.readAt !== null) return;
    try {
      const result = await markNotificationRead(notification.id);
      setItems((current) => withReadAt(current, new Set([result.id]), result.readAt));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setError('read');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, unreadCount, status, error, newIds, openBell, markRead };
}
