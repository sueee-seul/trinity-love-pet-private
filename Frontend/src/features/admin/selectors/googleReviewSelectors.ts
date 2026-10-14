import type { AdminGoogleReview, AdminGoogleReviewPage } from '../types/googleReview';

/**
 * Selects one review from an already-hydrated employee Google Review page.
 *
 * @remarks
 * This is a pure in-memory lookup. It returns `undefined` when the page or route id is absent and
 * never starts an API request; the detail page decides how to handle that fallback.
 */
export const selectGoogleReviewById = (
  reviewPage: AdminGoogleReviewPage | null,
  reviewId: string | undefined,
): AdminGoogleReview | undefined => {
  if (!reviewPage || !reviewId) {
    return undefined;
  }

  return reviewPage.reviews.find((review) => review.id === reviewId);
};
