import { z } from 'zod';

export const googleReviewLikeReviewIdSchema = z.string().uuid('Review UUID must be a valid UUID');

/**
 * Like state for one review as the public review page needs to render it.
 *
 * `likeCount` counts every reviewer, so it is readable while signed out.
 * `viewerHasLiked` is always false for an anonymous request, because an anonymous
 * request has no reviewer identity to match a like row against.
 */
export interface GoogleReviewLikeState {
  reviewId: string;
  likeCount: number;
  viewerHasLiked: boolean;
}
