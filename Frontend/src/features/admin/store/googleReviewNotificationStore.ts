import { useEffect } from 'react';
import { create } from 'zustand';
import { googleReviewNotificationsApi } from '../api/googleReviewNotificationsApi';
import type { ManagerNotification } from '../types/googleReviewNotification';

const GOOGLE_REVIEW_NOTIFICATION_LOAD_ERROR =
  'Google review notifications could not be loaded. Please try again later.';
const GOOGLE_REVIEW_NOTIFICATION_PAGE_LIMIT = 10;
/**
 * A booking request has no event stream, so the bell asks again on this interval while the tab is
 * visible. A manager who left the page open still sees a new request within a minute.
 */
export const MANAGER_NOTIFICATION_REFRESH_MS = 60_000;

export type GoogleReviewNotificationStatus = 'idle' | 'loading' | 'ready' | 'error';

interface GoogleReviewNotificationStoreState {
  items: ManagerNotification[];
  unreadCount: number;
  nextCursor: string | null;
  status: GoogleReviewNotificationStatus;
  error: string | null;
  revision: number;
  setLoading: () => void;
  hydrate: (items: ManagerNotification[], unreadCount: number, nextCursor: string | null) => void;
  append: (items: ManagerNotification[], unreadCount: number, nextCursor: string | null) => void;
  setError: (message: string, preserveReady: boolean) => void;
  applyRead: (notificationId: string, readAt: string) => void;
  applyReadAll: (notificationIds: string[], readAt: string | null) => void;
  reset: () => void;
}

export interface GoogleReviewNotificationsState {
  items: ManagerNotification[];
  unreadCount: number;
  nextCursor: string | null;
  status: GoogleReviewNotificationStatus;
  error: string | null;
}

export const useGoogleReviewNotificationStore = create<GoogleReviewNotificationStoreState>(
  (set) => ({
    items: [],
    unreadCount: 0,
    nextCursor: null,
    status: 'idle',
    error: null,
    revision: 0,
    setLoading: (): void => {
      set({ status: 'loading', error: null });
    },
    hydrate: (items, unreadCount, nextCursor): void => {
      set({ items, unreadCount, nextCursor, status: 'ready', error: null });
    },
    append: (items, unreadCount, nextCursor): void => {
      set((state) => {
        const existingIds = new Set(state.items.map((item) => item.id));
        const newItems = items.filter((item) => !existingIds.has(item.id));
        return {
          items: [...state.items, ...newItems],
          unreadCount,
          nextCursor,
          status: 'ready',
          error: null,
        };
      });
    },
    setError: (message, preserveReady): void => {
      set((state) => ({
        status: preserveReady && state.items.length > 0 ? 'ready' : 'error',
        error: message,
      }));
    },
    applyRead: (notificationId, readAt): void => {
      set((state) => {
        const item = state.items.find((notification) => notification.id === notificationId);
        const wasUnread = item?.readAt === null;
        return {
          items: state.items.map((notification) =>
            notification.id === notificationId ? { ...notification, readAt } : notification,
          ),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          error: null,
        };
      });
    },
    applyReadAll: (notificationIds, readAt): void => {
      const updatedIds = new Set(notificationIds);
      set((state) => ({
        items: state.items.map((notification) =>
          updatedIds.has(notification.id) && readAt ? { ...notification, readAt } : notification,
        ),
        unreadCount: notificationIds.length > 0 ? 0 : state.unreadCount,
        error: null,
      }));
    },
    reset: (): void => {
      set((state) => ({
        items: [],
        unreadCount: 0,
        nextCursor: null,
        status: 'idle',
        error: null,
        revision: state.revision + 1,
      }));
    },
  }),
);

interface ActiveNotificationRequest {
  cursor: string | null;
  revision: number;
  promise: Promise<void>;
}

let activeNotificationRequest: ActiveNotificationRequest | null = null;

const errorMessage = (caught: unknown): string => {
  return caught instanceof Error ? caught.message : GOOGLE_REVIEW_NOTIFICATION_LOAD_ERROR;
};

/** Loads the first notification page, sharing duplicate requests with the mounted bell. */
export const loadGoogleReviewNotifications = (force = false): Promise<void> => {
  const state = useGoogleReviewNotificationStore.getState();
  if (!force && state.status === 'ready') {
    return Promise.resolve();
  }

  const revision = state.revision;
  const cursor = null;
  if (
    activeNotificationRequest?.revision === revision &&
    activeNotificationRequest.cursor === cursor
  ) {
    return activeNotificationRequest.promise;
  }

  const isBackgroundRefresh = force && state.items.length > 0;
  if (!isBackgroundRefresh) {
    state.setLoading();
  }

  const request = googleReviewNotificationsApi
    .getNotifications(GOOGLE_REVIEW_NOTIFICATION_PAGE_LIMIT)
    .then((page) => {
      const currentState = useGoogleReviewNotificationStore.getState();
      if (currentState.revision !== revision) {
        return;
      }
      currentState.hydrate(page.items, page.unreadCount, page.nextCursor);
    })
    .catch((caught: unknown) => {
      const currentState = useGoogleReviewNotificationStore.getState();
      if (currentState.revision !== revision) {
        return;
      }
      currentState.setError(errorMessage(caught), isBackgroundRefresh);
    })
    .finally(() => {
      if (activeNotificationRequest?.promise === request) {
        activeNotificationRequest = null;
      }
    });

  activeNotificationRequest = { cursor, revision, promise: request };
  return request;
};

/** Loads the next cursor page and appends only notifications not already in the snapshot. */
export const loadMoreGoogleReviewNotifications = (): Promise<void> => {
  const state = useGoogleReviewNotificationStore.getState();
  if (!state.nextCursor) {
    return Promise.resolve();
  }

  const revision = state.revision;
  const cursor = state.nextCursor;
  if (
    activeNotificationRequest?.revision === revision &&
    activeNotificationRequest.cursor === cursor
  ) {
    return activeNotificationRequest.promise;
  }

  const request = googleReviewNotificationsApi
    .getNotifications(GOOGLE_REVIEW_NOTIFICATION_PAGE_LIMIT, cursor)
    .then((page) => {
      const currentState = useGoogleReviewNotificationStore.getState();
      if (currentState.revision !== revision) {
        return;
      }
      currentState.append(page.items, page.unreadCount, page.nextCursor);
    })
    .catch((caught: unknown) => {
      const currentState = useGoogleReviewNotificationStore.getState();
      if (currentState.revision === revision) {
        currentState.setError(errorMessage(caught), true);
      }
    })
    .finally(() => {
      if (activeNotificationRequest?.promise === request) {
        activeNotificationRequest = null;
      }
    });

  activeNotificationRequest = { cursor, revision, promise: request };
  return request;
};

/** Persists one notification read state and updates the local shade/count projection. */
export const markGoogleReviewNotificationRead = async (
  notificationId: string,
): Promise<boolean> => {
  try {
    const result = await googleReviewNotificationsApi.markRead(notificationId);
    useGoogleReviewNotificationStore.getState().applyRead(notificationId, result.readAt);
    return true;
  } catch (caught: unknown) {
    useGoogleReviewNotificationStore.getState().setError(errorMessage(caught), true);
    return false;
  }
};

/** Persists the current manager's Google Review read-all action. */
export const readAllGoogleReviewNotifications = async (): Promise<boolean> => {
  try {
    const result = await googleReviewNotificationsApi.readAll();
    useGoogleReviewNotificationStore.getState().applyReadAll(result.updatedIds, result.readAt);
    return true;
  } catch (caught: unknown) {
    useGoogleReviewNotificationStore.getState().setError(errorMessage(caught), true);
    return false;
  }
};

const refreshWhileVisible = (): void => {
  if (document.visibilityState === 'visible') {
    void loadGoogleReviewNotifications(true);
  }
};

/**
 * Reads the reactive notification projection, starts its initial request on mount, and refreshes
 * it on an interval and whenever the tab becomes visible again. A hidden tab does not poll.
 */
export const useGoogleReviewNotifications = (): GoogleReviewNotificationsState & {
  loadMore: () => Promise<void>;
  markRead: (notificationId: string) => Promise<boolean>;
  readAll: () => Promise<boolean>;
} => {
  const items = useGoogleReviewNotificationStore((state) => state.items);
  const unreadCount = useGoogleReviewNotificationStore((state) => state.unreadCount);
  const nextCursor = useGoogleReviewNotificationStore((state) => state.nextCursor);
  const status = useGoogleReviewNotificationStore((state) => state.status);
  const error = useGoogleReviewNotificationStore((state) => state.error);

  useEffect(() => {
    void loadGoogleReviewNotifications();
    const timer = window.setInterval(refreshWhileVisible, MANAGER_NOTIFICATION_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhileVisible);
    return (): void => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, []);

  return {
    items,
    unreadCount,
    nextCursor,
    status,
    error,
    loadMore: loadMoreGoogleReviewNotifications,
    markRead: markGoogleReviewNotificationRead,
    readAll: readAllGoogleReviewNotifications,
  };
};

/** Clears manager notification state when the employee session ends. */
export const resetGoogleReviewNotificationStore = (): void => {
  useGoogleReviewNotificationStore.getState().reset();
};
