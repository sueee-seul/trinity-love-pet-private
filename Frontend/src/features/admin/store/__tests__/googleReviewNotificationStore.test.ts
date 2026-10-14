import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { googleReviewNotificationsApi } from '../../api/googleReviewNotificationsApi';
import {
  MANAGER_NOTIFICATION_REFRESH_MS,
  loadGoogleReviewNotifications,
  useGoogleReviewNotifications,
  markGoogleReviewNotificationRead,
  readAllGoogleReviewNotifications,
  resetGoogleReviewNotificationStore,
  useGoogleReviewNotificationStore,
} from '../googleReviewNotificationStore';

const notification = {
  id: 'notification-1',
  type: 'google_review_created' as const,
  category: 'google_review' as const,
  title: 'New review from Emma',
  body: '5 stars · PetHouse',
  reviewerName: 'Emma',
  rating: 5,
  createdAt: '2026-09-11T09:00:00.000Z',
  readAt: null,
  target: {
    kind: 'google_review' as const,
    reviewId: 'review-1',
    placeSlug: 'PetHouse',
  },
};

describe('googleReviewNotificationStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetGoogleReviewNotificationStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGoogleReviewNotificationStore();
  });

  it('loads and caches the manager notification page', async () => {
    const getNotifications = vi
      .spyOn(googleReviewNotificationsApi, 'getNotifications')
      .mockResolvedValue({ items: [notification], unreadCount: 1, nextCursor: null });

    await loadGoogleReviewNotifications();

    expect(getNotifications).toHaveBeenCalledWith(10);
    expect(useGoogleReviewNotificationStore.getState()).toMatchObject({
      items: [notification],
      unreadCount: 1,
      status: 'ready',
      error: null,
    });
  });

  it('shares duplicate initial loads and does not create a second request', async () => {
    let resolvePage!: (page: {
      items: (typeof notification)[];
      unreadCount: number;
      nextCursor: null;
    }) => void;
    const pendingPage = new Promise<{
      items: (typeof notification)[];
      unreadCount: number;
      nextCursor: null;
    }>((resolve) => {
      resolvePage = resolve;
    });
    const getNotifications = vi
      .spyOn(googleReviewNotificationsApi, 'getNotifications')
      .mockReturnValue(pendingPage);

    const firstRequest = loadGoogleReviewNotifications();
    const duplicateRequest = loadGoogleReviewNotifications();

    expect(duplicateRequest).toBe(firstRequest);
    expect(getNotifications).toHaveBeenCalledOnce();

    resolvePage({ items: [notification], unreadCount: 1, nextCursor: null });
    await firstRequest;
  });

  it('persists one read state and updates the unread count', async () => {
    const readAt = '2026-09-11T09:05:00.000Z';
    useGoogleReviewNotificationStore.getState().hydrate([notification], 1, null);
    vi.spyOn(googleReviewNotificationsApi, 'markRead').mockResolvedValue({
      id: notification.id,
      readAt,
    });

    await expect(markGoogleReviewNotificationRead(notification.id)).resolves.toBe(true);

    expect(useGoogleReviewNotificationStore.getState()).toMatchObject({
      items: [{ ...notification, readAt }],
      unreadCount: 0,
      error: null,
    });
  });

  it('persists Read all and changes the read-state projection for returned rows', async () => {
    const secondNotification = { ...notification, id: 'notification-2', readAt: null };
    const readAt = '2026-09-11T09:05:00.000Z';
    useGoogleReviewNotificationStore
      .getState()
      .hydrate([notification, secondNotification], 2, null);
    vi.spyOn(googleReviewNotificationsApi, 'readAll').mockResolvedValue({
      updatedIds: [notification.id, secondNotification.id],
      readAt,
    });

    await expect(readAllGoogleReviewNotifications()).resolves.toBe(true);

    expect(useGoogleReviewNotificationStore.getState()).toMatchObject({
      items: [
        { ...notification, readAt },
        { ...secondNotification, readAt },
      ],
      unreadCount: 0,
    });
  });

  it('keeps the existing snapshot when a background refresh fails', async () => {
    useGoogleReviewNotificationStore.getState().hydrate([notification], 1, null);
    vi.spyOn(googleReviewNotificationsApi, 'getNotifications').mockRejectedValue(
      new Error('Notification service unavailable.'),
    );

    await loadGoogleReviewNotifications(true);

    expect(useGoogleReviewNotificationStore.getState()).toMatchObject({
      items: [notification],
      status: 'ready',
      error: 'Notification service unavailable.',
    });
  });
});

describe('useGoogleReviewNotifications refresh', () => {
  const setVisibility = (state: DocumentVisibilityState): void => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetGoogleReviewNotificationStore();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetGoogleReviewNotificationStore();
    setVisibility('visible');
  });

  const mountBell = async (): Promise<MockInstance> => {
    const getNotifications = vi
      .spyOn(googleReviewNotificationsApi, 'getNotifications')
      .mockResolvedValue({ items: [notification], unreadCount: 1, nextCursor: null });
    renderHook(() => useGoogleReviewNotifications());
    await act(async () => {
      await Promise.resolve();
    });
    return getNotifications;
  };

  it('asks again on the interval so a new booking request shows without a reload', async () => {
    const getNotifications = await mountBell();
    expect(getNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MANAGER_NOTIFICATION_REFRESH_MS);
    });

    expect(getNotifications).toHaveBeenCalledTimes(2);
  });

  it('does not poll a hidden tab and refreshes when the tab is shown again', async () => {
    const getNotifications = await mountBell();
    setVisibility('hidden');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MANAGER_NOTIFICATION_REFRESH_MS);
    });
    expect(getNotifications).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(getNotifications).toHaveBeenCalledTimes(2);
  });
});
