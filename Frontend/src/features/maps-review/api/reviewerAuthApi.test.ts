import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewerAuthApi } from './reviewerAuthApi';

describe('reviewerAuthApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs reviewers in through the dedicated endpoint with an authorization code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { reviewer: { id: 'reviewer-1', displayName: 'Taylor Morgan', avatarUrl: null } },
      }),
    } as Response);

    await expect(
      reviewerAuthApi.loginWithGoogleCode('google-authorization-code'),
    ).resolves.toMatchObject({
      ok: true,
      data: { id: 'reviewer-1', displayName: 'Taylor Morgan' },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review-auth/google'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ authorizationCode: 'google-authorization-code' }),
      }),
    );
  });

  it('hydrates from the reviewer session and treats 401 as an empty session', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { reviewer: { id: 'reviewer-1', displayName: 'Taylor Morgan', avatarUrl: null } },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ msg: 'Authentication required', data: null }),
      } as Response);

    await expect(reviewerAuthApi.getCurrentReviewer()).resolves.toMatchObject({
      ok: true,
      data: { id: 'reviewer-1' },
    });
    await expect(reviewerAuthApi.getCurrentReviewer()).resolves.toMatchObject({
      ok: false,
      data: null,
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/review-auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('posts the review payload and retains the backend error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ msg: 'Rating is required.', data: null }),
    } as Response);

    await expect(
      reviewerAuthApi.submitReview({ placeSlug: 'PetHouse', rating: 0 }, [
        new File(['image'], 'review.jpg', { type: 'image/jpeg' }),
      ]),
    ).resolves.toMatchObject({ ok: false, data: null, message: 'Rating is required.' });
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = request?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(JSON.parse(body.get('payload') as string)).toEqual({
      placeSlug: 'PetHouse',
      rating: 0,
    });
    expect(body.get('photos')).toBeInstanceOf(File);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/google-reviews'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body,
      }),
    );
  });

  it('deletes a review without a reviewer session and retains the backend error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: 'Live reviews cannot be deleted' } }),
    } as Response);

    await expect(reviewerAuthApi.deleteReview('review-1')).resolves.toMatchObject({
      ok: false,
      data: null,
      message: 'Live reviews cannot be deleted',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/google-reviews/review-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('loads and validates a review page from the server', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          location: {
            id: 'location-1',
            displayName: 'PetHouse',
            formattedAddress: null,
            googleMapsUri: null,
            averageRating: 5,
            totalReviews: 1,
            ratingBreakdown: [{ stars: 5, count: 1 }],
          },
          reviews: [],
        },
      }),
    } as Response);

    await expect(reviewerAuthApi.getReviewPage('Pet House / NZ')).resolves.toMatchObject({
      ok: true,
      data: { location: { displayName: 'PetHouse' }, reviews: [] },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/google-reviews?placeSlug=Pet%20House%20%2F%20NZ'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('rejects a review page response without persisted photo URLs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          location: {
            id: 'location-1',
            displayName: 'PetHouse',
            formattedAddress: null,
            googleMapsUri: null,
            averageRating: null,
            totalReviews: 0,
            ratingBreakdown: [],
          },
          reviews: [
            {
              id: 'review-1',
              reviewerName: 'Taylor Morgan',
              reviewerAvatarUrl: null,
              reviewerIsAnonymous: false,
              rating: 5,
              reviewText: 'Great care',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ownerReply: null,
              ownerReplyUpdatedAt: null,
            },
          ],
        },
      }),
    } as Response);

    await expect(reviewerAuthApi.getReviewPage('PetHouse')).rejects.toThrow(
      'Invalid review page response',
    );
  });

  it('clears the reviewer session through the dedicated logout endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await expect(reviewerAuthApi.logout()).resolves.toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review-auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
