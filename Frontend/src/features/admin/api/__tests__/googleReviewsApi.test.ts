import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleReviewsApi } from '../googleReviewsApi';
import type { AdminGoogleReview } from '../../types/googleReview';

const review: AdminGoogleReview = {
  id: 'review-1',
  reviewerName: 'Jamie',
  reviewerEmail: null,
  reviewerAvatarUrl: null,
  reviewerIsAnonymous: false,
  rating: 5,
  reviewText: 'Great care.',
  photoUrls: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ownerReply: null,
  ownerReplyUpdatedAt: null,
  triageType: null,
  isRead: false,
  currentStatus: 'received',
  assignedEmployeeUuid: null,
};

describe('googleReviewsApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('loads the lean review projection', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { reviews: [review] } }),
    });

    await expect(googleReviewsApi.getReviews('PetHouse')).resolves.toMatchObject({
      ok: true,
      data: { reviews: [review] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-reviews?placeSlug=PetHouse',
      { credentials: 'include' },
    );
  });

  it('sends a manually composed reply and validates the returned review', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { ...review, ownerReply: 'Thank you.' } }),
    });

    await expect(
      googleReviewsApi.replyToGoogleReview('review-1', 'Thank you.'),
    ).resolves.toMatchObject({
      ownerReply: 'Thank you.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-reviews/review-1/reply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ replyBody: 'Thank you.' }),
      }),
    );
  });

  it('saves a manager-selected type without AI result fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { ...review, triageType: 'issue' } }),
    });

    await expect(googleReviewsApi.updateReviewType('review-1', 'issue')).resolves.toMatchObject({
      triageType: 'issue',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-reviews/review-1/type',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ triageType: 'issue' }) }),
    );
  });
});
