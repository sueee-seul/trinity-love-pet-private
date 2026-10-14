import { useCallback, useRef, useState } from 'react';
import { reviewerAuthApi, type ReviewerProfile } from '../api/reviewerAuthApi';
import type { PublicGoogleBusinessReview } from '../types/reviewTypes';

type ReviewsUpdater = (
  updater: (reviews: PublicGoogleBusinessReview[]) => PublicGoogleBusinessReview[],
) => void;

interface UseReviewLikesOptions {
  /**
   * Resolves the signed-in reviewer from already-loaded state, hydrating only a session that
   * has not settled yet. Cheap enough to call on every tap.
   */
  resolveReviewer: () => Promise<ReviewerProfile | null>;
  /**
   * Re-checks the session against the server and returns the result. Used only after a failed
   * request, because `resolveReviewer` reads cached state and cannot notice an expired session.
   */
  revalidateReviewer: () => Promise<ReviewerProfile | null>;
  /** Called when a signed-out visitor tries to like. The caller owns the sign-in flow. */
  onLoginRequired: () => void;
  /** Applies a change to the loaded review list held by the caller. */
  applyReviews: ReviewsUpdater;
}

interface ReviewLikesHook {
  toggleLike: (reviewId: string, viewerHasLiked: boolean) => Promise<void>;
  likeError: string | null;
}

const LIKE_FAILED_MESSAGE = 'Your like could not be saved. Please try again.';

const withLikeState = (
  reviews: PublicGoogleBusinessReview[],
  reviewId: string,
  viewerHasLiked: boolean,
  likeCount: number,
): PublicGoogleBusinessReview[] =>
  reviews.map((review) =>
    review.id === reviewId
      ? { ...review, viewerHasLiked, likeCount: Math.max(0, likeCount) }
      : review,
  );

/**
 * Toggles the signed-in reviewer's like on a review.
 *
 * A signed-out visitor never reaches the API: the hook calls `onLoginRequired` instead, which
 * is what sends them to sign in. The count updates optimistically and is then replaced by the
 * server's count, so a failed request never leaves an inflated count behind. A second click on
 * the same review is ignored while its request is still in flight.
 */
export function useReviewLikes(options: UseReviewLikesOptions): ReviewLikesHook {
  const { resolveReviewer, revalidateReviewer, onLoginRequired, applyReviews } = options;
  const [likeError, setLikeError] = useState<string | null>(null);
  const pendingReviewIdsRef = useRef<Set<string>>(new Set());

  const toggleLike = useCallback(
    async (reviewId: string, viewerHasLiked: boolean): Promise<void> => {
      if (pendingReviewIdsRef.current.has(reviewId)) {
        return;
      }

      const reviewer = await resolveReviewer();
      if (!reviewer) {
        onLoginRequired();
        return;
      }

      const nextLiked = !viewerHasLiked;
      const likeDelta = nextLiked ? 1 : -1;
      const rollback = (): void => {
        applyReviews((reviews) =>
          reviews.map((review) =>
            review.id === reviewId
              ? {
                  ...review,
                  viewerHasLiked,
                  likeCount: Math.max(0, review.likeCount - likeDelta),
                }
              : review,
          ),
        );
      };

      pendingReviewIdsRef.current.add(reviewId);
      setLikeError(null);
      applyReviews((reviews) =>
        reviews.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                viewerHasLiked: nextLiked,
                likeCount: Math.max(0, review.likeCount + likeDelta),
              }
            : review,
        ),
      );

      try {
        const result = await reviewerAuthApi.setReviewLike(reviewId, nextLiked);
        const likeState = result.data;
        if (result.ok && likeState) {
          applyReviews((reviews) =>
            withLikeState(reviews, reviewId, likeState.viewerHasLiked, likeState.likeCount),
          );
          return;
        }

        rollback();

        // The session can expire between page load and the click. Asking the server tells the
        // two failures apart: a lost session sends the visitor to sign in, anything else is
        // reported in place.
        const currentReviewer = await revalidateReviewer();
        if (!currentReviewer) {
          onLoginRequired();
          return;
        }

        setLikeError(result.message ?? LIKE_FAILED_MESSAGE);
      } catch {
        rollback();
        setLikeError(LIKE_FAILED_MESSAGE);
      } finally {
        pendingReviewIdsRef.current.delete(reviewId);
      }
    },
    [applyReviews, onLoginRequired, resolveReviewer, revalidateReviewer],
  );

  return { toggleLike, likeError };
}
