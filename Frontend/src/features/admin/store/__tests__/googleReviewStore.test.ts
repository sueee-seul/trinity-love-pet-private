import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../../../../shared/events/__tests__/fakeEventSource';
import { googleReviewsApi } from '../../api/googleReviewsApi';
import { googleReviewNotificationsApi } from '../../api/googleReviewNotificationsApi';
import {
  loadGoogleReviewPage,
  resetGoogleReviewStore,
  useGoogleReviewStore,
  useGoogleReviewStoreSync,
} from '../googleReviewStore';
import {
  resetGoogleReviewNotificationStore,
  useGoogleReviewNotificationStore,
} from '../googleReviewNotificationStore';
import type { AdminGoogleReviewPage } from '../../types/googleReview';

const reviewPage: AdminGoogleReviewPage = {
  reviews: [
    {
      id: 'google-review-1',
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5,
      reviewText: 'Great care.',
      photoUrls: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      ownerReply: null,
      ownerReplyUpdatedAt: null,
      triageType: 'praise',
      isRead: false,
      currentStatus: 'received',
      assignedEmployeeUuid: null,
    },
  ],
};

const notificationPage = {
  items: [],
  unreadCount: 0,
  nextCursor: null,
};

describe('googleReviewStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    resetGoogleReviewStore();
    resetGoogleReviewNotificationStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetGoogleReviewStore();
    resetGoogleReviewNotificationStore();
  });

  it('loads the lean employee review projection without generating reply drafts', async () => {
    const getReviews = vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });

    await loadGoogleReviewPage();

    expect(getReviews).toHaveBeenCalledWith('PetHouse');
    expect(useGoogleReviewStore.getState()).toMatchObject({
      reviewPage,
      status: 'ready',
      error: null,
    });
  });

  it('refreshes the list and manager notifications after a review-created event', async () => {
    const getReviews = vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });
    const getNotifications = vi
      .spyOn(googleReviewNotificationsApi, 'getNotifications')
      .mockResolvedValue(notificationPage);

    renderHook(() => useGoogleReviewStoreSync(true));
    FakeEventSource.instances[0]?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'created',
    });

    await waitFor(() => expect(getNotifications).toHaveBeenCalledWith(10));
    expect(getReviews).toHaveBeenCalledWith('PetHouse');
    expect(useGoogleReviewNotificationStore.getState()).toMatchObject({
      items: [],
      unreadCount: 0,
      status: 'ready',
    });
  });

  it('records an API error without fabricating review data', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Review service unavailable.',
    });

    await loadGoogleReviewPage();

    expect(useGoogleReviewStore.getState()).toMatchObject({
      reviewPage: null,
      status: 'error',
      error: 'Review service unavailable.',
    });
  });
});
