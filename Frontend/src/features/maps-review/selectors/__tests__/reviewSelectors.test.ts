import { describe, expect, it } from 'vitest';
import type { GoogleBusinessReview } from '../../types/reviewTypes';
import { selectReviewList } from '../reviewSelectors';

const createReview = (overrides: Partial<GoogleBusinessReview>): GoogleBusinessReview => ({
  id: 'review-default',
  reviewerName: 'Reviewer',
  reviewerAvatarUrl: null,
  reviewerIsAnonymous: false,
  rating: 3,
  reviewText: null,
  photoUrls: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ownerReply: null,
  ownerReplyUpdatedAt: null,
  ...overrides,
});

const reviews = [
  createReview({
    id: 'service-review',
    reviewerName: 'PetHouse reviewer',
    rating: 4,
    reviewText: 'PetHouse made the Deluxe suite and Extra playtime easy for our dog.',
    createdAt: '2026-08-01T00:00:00.000Z',
  }),
  createReview({
    id: 'name-only-review',
    reviewerName: 'PetHouse name only',
    rating: 5,
    reviewText: 'A quiet garden made the stay comfortable.',
    createdAt: '2026-08-03T00:00:00.000Z',
  }),
  createReview({
    id: 'food-review',
    rating: 2,
    reviewText: 'The House food routine was easy to follow.',
    createdAt: '2026-08-02T00:00:00.000Z',
  }),
];

const selectIds = (
  searchQuery: string,
  sortOption: Parameters<typeof selectReviewList>[1]['sortOption'],
): string[] => selectReviewList(reviews, { searchQuery, sortOption }).map((review) => review.id);

describe('selectReviewList', () => {
  it('searches review content only and ignores reviewer names', () => {
    expect(selectIds('GARDEN', 'relevance')).toEqual(['name-only-review']);
    expect(selectIds('PetHouse', 'relevance')).toEqual(['service-review']);
  });

  it('ranks service and PetHouse mentions first for Most relevant', () => {
    expect(selectIds('', 'relevance')).toEqual([
      'service-review',
      'food-review',
      'name-only-review',
    ]);
  });

  it('sorts by newest, highest rating, and lowest rating', () => {
    expect(selectIds('', 'newest')).toEqual(['name-only-review', 'food-review', 'service-review']);
    expect(selectIds('', 'highest')).toEqual(['name-only-review', 'service-review', 'food-review']);
    expect(selectIds('', 'lowest')).toEqual(['food-review', 'service-review', 'name-only-review']);
  });
});
