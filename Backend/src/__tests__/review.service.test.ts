import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewService } from '../services/review.service.js';

const {
  createGoogleBusinessReviewRecordMock,
  createReviewRecordMock,
  deleteMockGoogleBusinessReviewRecordMock,
  findGoogleBusinessReviewPageMock,
  removeReviewPhotosMock,
  resolveReviewPhotoUrlsMock,
  saveReviewPhotosMock,
  upsertSimulatorReviewerMock,
  publishGoogleReviewEventMock,
  setGoogleReviewLikeMock,
} = vi.hoisted(() => ({
  createGoogleBusinessReviewRecordMock: vi.fn(),
  createReviewRecordMock: vi.fn(),
  deleteMockGoogleBusinessReviewRecordMock: vi.fn(),
  findGoogleBusinessReviewPageMock: vi.fn(),
  removeReviewPhotosMock: vi.fn(),
  resolveReviewPhotoUrlsMock: vi.fn(),
  saveReviewPhotosMock: vi.fn(),
  upsertSimulatorReviewerMock: vi.fn(),
  publishGoogleReviewEventMock: vi.fn(),
  setGoogleReviewLikeMock: vi.fn(),
}));

vi.mock('../repositories/review.repository.js', () => ({
  createGoogleBusinessReviewRecord: createGoogleBusinessReviewRecordMock,
  createReviewRecord: createReviewRecordMock,
  deleteMockGoogleBusinessReviewRecord: deleteMockGoogleBusinessReviewRecordMock,
  findGoogleBusinessReviewPage: findGoogleBusinessReviewPageMock,
}));

vi.mock('../repositories/review.like.repository.js', () => ({
  setGoogleReviewLike: setGoogleReviewLikeMock,
}));

vi.mock('../services/reviewer.service.js', () => ({
  ReviewerService: { upsertSimulatorReviewer: upsertSimulatorReviewerMock },
}));

vi.mock('../services/review.photo.storage.js', () => ({
  removeReviewPhotos: removeReviewPhotosMock,
  resolveReviewPhotoUrls: resolveReviewPhotoUrlsMock,
  saveReviewPhotos: saveReviewPhotosMock,
}));

vi.mock('../services/google.review.events.js', () => ({
  publishGoogleReviewEvent: publishGoogleReviewEventMock,
}));

const reviewRow = {
  id: '00000000-0000-4000-8000-000000000902',
  reviewer_id: '00000000-0000-4000-8000-000000000901',
  place_slug: 'boarding_title',
  rating: 4,
  review_text: 'Good care.',
  source: 'human' as const,
  service_user_match_status: 'pending' as const,
  created_at: new Date('2026-08-31T00:00:00.000Z'),
};

beforeEach(() => {
  createGoogleBusinessReviewRecordMock.mockReset();
  createReviewRecordMock.mockReset();
  findGoogleBusinessReviewPageMock.mockReset();
  upsertSimulatorReviewerMock.mockReset();
  deleteMockGoogleBusinessReviewRecordMock.mockReset();
  removeReviewPhotosMock.mockReset();
  resolveReviewPhotoUrlsMock.mockReset();
  saveReviewPhotosMock.mockReset();
  publishGoogleReviewEventMock.mockReset();
  setGoogleReviewLikeMock.mockReset();
  saveReviewPhotosMock.mockResolvedValue([]);
  resolveReviewPhotoUrlsMock.mockResolvedValue([]);
});

describe('ReviewService', () => {
  it('maps persisted Google-shaped reviews into the page response', async () => {
    findGoogleBusinessReviewPageMock.mockResolvedValueOnce({
      location: {
        id: '00000000-0000-4000-8000-000000000401',
        display_name: 'PetHouse',
        formatted_address: '18 PetHouse Lane, Grey Lynn, Auckland 1021',
        google_maps_uri: null,
        aggregate_rating: null,
        user_rating_count: 0,
      },
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000000902',
          reviewer_display_name: 'Google Reviewer',
          reviewer_profile_photo_url: null,
          reviewer_is_anonymous: false,
          rating: 5,
          comment: 'Great care.',
          google_created_at: new Date('2026-09-01T00:00:00.000Z'),
          google_updated_at: new Date('2026-09-01T00:00:00.000Z'),
          owner_reply: 'The latest sent reply',
          owner_reply_updated_at: new Date('2026-09-02T01:00:00.000Z'),
          photo_urls: ['google-reviews/upload-1/cat-photo.png'],
        },
      ],
    });
    resolveReviewPhotoUrlsMock.mockResolvedValueOnce(['https://signed.example.test/cat-photo.png']);

    const result = await ReviewService.getGoogleReviewPage('PetHouse');

    expect(result?.location.ratingBreakdown).toEqual([
      { stars: 5, count: 1 },
      { stars: 4, count: 0 },
      { stars: 3, count: 0 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ]);
    expect(result).toMatchObject({
      location: {
        id: '00000000-0000-4000-8000-000000000401',
        displayName: 'PetHouse',
        averageRating: 5,
        totalReviews: 1,
        ratingBreakdown: expect.arrayContaining([{ stars: 5, count: 1 }]),
      },
      reviews: [
        expect.objectContaining({
          id: '00000000-0000-4000-8000-000000000902',
          reviewerName: 'Google Reviewer',
          rating: 5,
          reviewText: 'Great care.',
          ownerReply: 'The latest sent reply',
          ownerReplyUpdatedAt: '2026-09-02T01:00:00.000Z',
          photoUrls: ['https://signed.example.test/cat-photo.png'],
        }),
      ],
    });
    expect(findGoogleBusinessReviewPageMock).toHaveBeenCalledWith('PetHouse', null);
    expect(resolveReviewPhotoUrlsMock).toHaveBeenCalledWith([
      'google-reviews/upload-1/cat-photo.png',
    ]);
  });

  it('owns the human source and normalizes blank text to null', async () => {
    createGoogleBusinessReviewRecordMock.mockResolvedValueOnce({ ...reviewRow, review_text: null });

    await ReviewService.createHumanReview(
      {
        id: '00000000-0000-4000-8000-000000000901',
        displayName: 'Google Reviewer',
        avatarUrl: null,
      },
      {
        placeSlug: 'boarding_title',
        rating: 4,
        reviewText: '',
      },
    );

    expect(createGoogleBusinessReviewRecordMock).toHaveBeenCalledWith({
      reviewerId: '00000000-0000-4000-8000-000000000901',
      reviewerDisplayName: 'Google Reviewer',
      reviewerAvatarUrl: null,
      placeSlug: 'boarding_title',
      rating: 4,
      reviewText: null,
      photoUrls: [],
      notifyActiveManagers: true,
    });
    expect(createReviewRecordMock).not.toHaveBeenCalled();
    expect(publishGoogleReviewEventMock).toHaveBeenCalledOnce();
    expect(publishGoogleReviewEventMock).toHaveBeenCalledWith({
      target: 'both',
      placeSlug: 'boarding_title',
      changeType: 'created',
    });
  });

  it('persists the human review without invoking a model', async () => {
    createGoogleBusinessReviewRecordMock.mockResolvedValueOnce({
      ...reviewRow,
      place_slug: 'PetHouse',
    });

    await expect(
      ReviewService.createHumanReview(
        { id: 'reviewer-1', displayName: 'Reviewer', avatarUrl: null },
        { placeSlug: 'PetHouse', rating: 5, reviewText: 'Great.' },
        [],
      ),
    ).resolves.toMatchObject({ source: 'human' });

    expect(createGoogleBusinessReviewRecordMock).toHaveBeenCalledWith({
      reviewerId: 'reviewer-1',
      reviewerDisplayName: 'Reviewer',
      reviewerAvatarUrl: null,
      placeSlug: 'PetHouse',
      rating: 5,
      reviewText: 'Great.',
      photoUrls: [],
      notifyActiveManagers: true,
    });
  });

  it('uses the same creation path for simulator reviews and owns simulator source', async () => {
    upsertSimulatorReviewerMock.mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000903',
      displayName: 'Fixture Reviewer',
      avatarUrl: null,
    });
    createGoogleBusinessReviewRecordMock.mockResolvedValueOnce({
      ...reviewRow,
      reviewer_id: '00000000-0000-4000-8000-000000000903',
    });

    const result = await ReviewService.createSimulatorReview({
      authorKey: 'fixture-reviewer',
      displayName: 'Fixture Reviewer',
      avatarUrl: null,
      email: null,
      placeSlug: 'boarding_title',
      rating: 4,
      reviewText: 'Good care.',
    });

    expect(result).toMatchObject({
      id: '00000000-0000-4000-8000-000000000902',
      source: 'simulator',
    });
    expect(createGoogleBusinessReviewRecordMock).toHaveBeenCalledWith({
      reviewerId: '00000000-0000-4000-8000-000000000903',
      reviewerDisplayName: 'Fixture Reviewer',
      reviewerAvatarUrl: null,
      placeSlug: 'boarding_title',
      rating: 4,
      reviewText: 'Good care.',
      photoUrls: [],
      notifyActiveManagers: false,
    });
    expect(createReviewRecordMock).not.toHaveBeenCalled();
  });

  it('raises not found when the mock review does not exist', async () => {
    deleteMockGoogleBusinessReviewRecordMock.mockResolvedValueOnce(null);

    await expect(
      ReviewService.deleteMockGoogleBusinessReview('00000000-0000-4000-8000-000000000902'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    expect(publishGoogleReviewEventMock).not.toHaveBeenCalled();
  });

  it('removes stored photos when the review insert fails', async () => {
    const photoUrls = ['/uploads/google-reviews/cat.jpg'];
    saveReviewPhotosMock.mockResolvedValueOnce(photoUrls);
    createGoogleBusinessReviewRecordMock.mockRejectedValueOnce(new Error('database failed'));

    await expect(
      ReviewService.createHumanReview(
        { id: 'reviewer-1', displayName: 'Reviewer', avatarUrl: null },
        { placeSlug: 'PetHouse', rating: 5, reviewText: 'Great.' },
        [],
      ),
    ).rejects.toThrow('database failed');

    expect(removeReviewPhotosMock).toHaveBeenCalledWith(photoUrls);
  });

  it('removes stored photos after deleting a mock review', async () => {
    const photoUrls = ['/uploads/google-reviews/cat.jpg'];
    deleteMockGoogleBusinessReviewRecordMock.mockResolvedValueOnce({ photoUrls });

    await ReviewService.deleteMockGoogleBusinessReview('00000000-0000-4000-8000-000000000902');

    expect(removeReviewPhotosMock).toHaveBeenCalledWith(photoUrls);
    expect(publishGoogleReviewEventMock).toHaveBeenCalledOnce();
    expect(publishGoogleReviewEventMock).toHaveBeenCalledWith({
      target: 'both',
      placeSlug: 'PetHouse',
      changeType: 'deleted',
    });
  });

  it('exposes like state on the page and marks the viewer own likes', async () => {
    findGoogleBusinessReviewPageMock.mockResolvedValueOnce({
      location: {
        id: '00000000-0000-4000-8000-000000000401',
        display_name: 'PetHouse',
        formatted_address: null,
        google_maps_uri: null,
        aggregate_rating: null,
        user_rating_count: 0,
      },
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000000902',
          reviewer_display_name: 'Google Reviewer',
          reviewer_profile_photo_url: null,
          reviewer_is_anonymous: false,
          rating: 5,
          comment: 'Great care.',
          google_created_at: new Date('2026-09-01T00:00:00.000Z'),
          google_updated_at: new Date('2026-09-01T00:00:00.000Z'),
          owner_reply: null,
          owner_reply_updated_at: null,
          like_count: 4,
          viewer_has_liked: true,
        },
      ],
    });

    const result = await ReviewService.getGoogleReviewPage(
      'PetHouse',
      '00000000-0000-4000-8000-000000000901',
    );

    expect(findGoogleBusinessReviewPageMock).toHaveBeenCalledWith(
      'PetHouse',
      '00000000-0000-4000-8000-000000000901',
    );
    expect(result?.reviews[0]).toMatchObject({ likeCount: 4, viewerHasLiked: true });
  });

  it('loads the page for an anonymous visitor without a reviewer identity', async () => {
    findGoogleBusinessReviewPageMock.mockResolvedValueOnce(null);

    await ReviewService.getGoogleReviewPage('PetHouse');

    expect(findGoogleBusinessReviewPageMock).toHaveBeenCalledWith('PetHouse', null);
  });

  it('returns the stored like state after a reviewer likes a review', async () => {
    const likeState = {
      reviewId: '00000000-0000-4000-8000-000000000902',
      likeCount: 1,
      viewerHasLiked: true,
    };
    setGoogleReviewLikeMock.mockResolvedValueOnce(likeState);

    const result = await ReviewService.setReviewLike(
      '00000000-0000-4000-8000-000000000901',
      '00000000-0000-4000-8000-000000000902',
      true,
    );

    expect(result).toEqual(likeState);
    expect(setGoogleReviewLikeMock).toHaveBeenCalledWith({
      reviewId: '00000000-0000-4000-8000-000000000902',
      reviewerId: '00000000-0000-4000-8000-000000000901',
      liked: true,
    });
  });

  it('reports a missing review as a not-found error rather than a silent no-op', async () => {
    setGoogleReviewLikeMock.mockResolvedValueOnce(null);

    await expect(
      ReviewService.setReviewLike(
        '00000000-0000-4000-8000-000000000901',
        '00000000-0000-4000-8000-000000000902',
        true,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
