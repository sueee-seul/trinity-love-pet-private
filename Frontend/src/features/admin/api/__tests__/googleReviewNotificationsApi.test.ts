import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleReviewNotificationsApi } from '../googleReviewNotificationsApi';

const notification = {
  id: 'notification-1',
  type: 'google_review_created',
  category: 'google_review',
  title: 'New review from Emma',
  body: '5 stars · PetHouse',
  reviewerName: 'Emma',
  rating: 5,
  createdAt: '2026-09-11T09:00:00.000Z',
  readAt: null,
  target: {
    kind: 'google_review',
    reviewId: 'review-1',
    placeSlug: 'PetHouse',
  },
};

describe('googleReviewNotificationsApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('loads the manager notification projection with cursor pagination', async () => {
    const page = { items: [notification], unreadCount: 1, nextCursor: 'next-page' };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, data: page }),
    });

    await expect(googleReviewNotificationsApi.getNotifications(10, 'cursor-1')).resolves.toEqual(
      page,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-review-notifications?limit=10&cursor=cursor-1',
      { credentials: 'include' },
    );
  });

  it('marks one notification read', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { id: 'notification-1', readAt: notification.createdAt },
      }),
    });

    await expect(googleReviewNotificationsApi.markRead('notification-1')).resolves.toEqual({
      id: 'notification-1',
      readAt: notification.createdAt,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-review-notifications/notification-1/read',
      { method: 'PATCH', credentials: 'include' },
    );
  });

  it('marks all current manager Google Review notifications read', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { updatedIds: ['notification-1'], readAt: notification.createdAt },
      }),
    });

    await expect(googleReviewNotificationsApi.readAll()).resolves.toEqual({
      updatedIds: ['notification-1'],
      readAt: notification.createdAt,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-review-notifications/read-all',
      { method: 'PATCH', credentials: 'include' },
    );
  });

  it('accepts a new booking request next to the review notices', async () => {
    const bookingRequest = {
      id: 'notification-2',
      type: 'booking_request_created',
      category: 'booking',
      title: 'New booking request',
      body: 'Max, 12 to 15 Oct 2026. Reference PB-ABC123.',
      createdAt: '2026-09-12T09:00:00.000Z',
      readAt: null,
      target: { kind: 'booking', bookingId: 'booking-1' },
    };
    const page = { items: [bookingRequest, notification], unreadCount: 2, nextCursor: null };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 200, data: page }) });

    await expect(googleReviewNotificationsApi.getNotifications()).resolves.toEqual(page);
  });

  it('rejects a booking request without the booking it points to', async () => {
    const withoutTarget = {
      id: 'notification-2',
      type: 'booking_request_created',
      category: 'booking',
      title: 'New booking request',
      body: 'Max.',
      createdAt: '2026-09-12T09:00:00.000Z',
      readAt: null,
      target: { kind: 'booking' },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { items: [withoutTarget], unreadCount: 1, nextCursor: null },
      }),
    });

    await expect(googleReviewNotificationsApi.getNotifications()).rejects.toThrow(
      'Invalid Google review notification response',
    );
  });

  it('rejects an invalid notification page instead of fabricating rows', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 200, data: { items: [{ ...notification, rating: 6 }] } }),
    });

    await expect(googleReviewNotificationsApi.getNotifications()).rejects.toThrow(
      'Invalid Google review notification response',
    );
  });
});
