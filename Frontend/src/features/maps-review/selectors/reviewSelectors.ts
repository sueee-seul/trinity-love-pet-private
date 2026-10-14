import type { GoogleBusinessReview } from '../types/reviewTypes';

export const REVIEW_SORT_OPTIONS = ['relevance', 'newest', 'highest', 'lowest'] as const;
export type ReviewSortOption = (typeof REVIEW_SORT_OPTIONS)[number];

export interface ReviewListOptions {
  searchQuery: string;
  sortOption: ReviewSortOption;
}

const RELEVANCE_PHRASES = ['pethouse', 'deluxe suite', 'house food', 'extra playtime'] as const;

const normalize = (value: string | null): string =>
  value?.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() ?? '';

const countPhraseOccurrences = (content: string, phrase: string): number => {
  let count = 0;
  let startIndex = 0;

  while (startIndex < content.length) {
    const matchIndex = content.indexOf(phrase, startIndex);
    if (matchIndex === -1) {
      break;
    }

    count += 1;
    startIndex = matchIndex + phrase.length;
  }

  return count;
};

const getRelevance = (review: GoogleBusinessReview): { distinct: number; total: number } => {
  const content = normalize(review.reviewText);
  const counts = RELEVANCE_PHRASES.map((phrase) => countPhraseOccurrences(content, phrase));

  return {
    distinct: counts.filter((count) => count > 0).length,
    total: counts.reduce((sum, count) => sum + count, 0),
  };
};

const getCreatedTimestamp = (review: GoogleBusinessReview): number => {
  const timestamp = Date.parse(review.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const compareNewest = (left: GoogleBusinessReview, right: GoogleBusinessReview): number => {
  return getCreatedTimestamp(right) - getCreatedTimestamp(left) || right.id.localeCompare(left.id);
};

const compareReviews = (
  left: GoogleBusinessReview,
  right: GoogleBusinessReview,
  sortOption: ReviewSortOption,
): number => {
  if (sortOption === 'highest') {
    return right.rating - left.rating || compareNewest(left, right);
  }

  if (sortOption === 'lowest') {
    return left.rating - right.rating || compareNewest(left, right);
  }

  if (sortOption === 'newest') {
    return compareNewest(left, right);
  }

  const leftRelevance = getRelevance(left);
  const rightRelevance = getRelevance(right);

  return (
    rightRelevance.distinct - leftRelevance.distinct ||
    rightRelevance.total - leftRelevance.total ||
    compareNewest(left, right)
  );
};

export const selectReviewList = <TReview extends GoogleBusinessReview>(
  reviews: readonly TReview[],
  options: ReviewListOptions,
): TReview[] => {
  const searchQuery = normalize(options.searchQuery);

  return reviews
    .filter((review) => !searchQuery || normalize(review.reviewText).includes(searchQuery))
    .sort((left, right) => compareReviews(left, right, options.sortOption));
};
