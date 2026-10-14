/** The query parameter a shared review link carries, written here and read by the review page. */
export const REVIEW_SHARE_PARAM = 'review';

/** The DOM id of a review card, which is what the page scrolls a shared link to. */
export const reviewAnchorId = (reviewId: string): string => `review-${reviewId}`;

/**
 * Builds the link the share dialog hands out for a single review.
 *
 * @remarks
 * Google Maps shares a review as a deep link back to the page it lives on, so the current page
 * URL is the source of truth here. Existing query parameters are dropped because the page's
 * search and sort state belongs to the visitor who is sharing, not to the recipient.
 */
export const buildReviewShareUrl = (reviewId: string): string => {
  const shareUrl = new URL(window.location.href);
  shareUrl.search = '';
  shareUrl.hash = '';
  shareUrl.searchParams.set(REVIEW_SHARE_PARAM, reviewId);
  return shareUrl.toString();
};
