import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import type { GoogleReviewLikeState } from '../contracts/google.review.like.contract.js';

export interface SetGoogleReviewLikeInput {
  reviewId: string;
  reviewerId: string;
  liked: boolean;
}

interface GoogleReviewLikeStateRow {
  like_count: number;
  viewer_has_liked: boolean;
}

/**
 * Applies one reviewer's like or unlike and reads back the resulting like state.
 *
 * The write and the count run in the same transaction so the returned count already
 * includes this reviewer's change. Liking twice is not an error: the unique constraint
 * on (review, reviewer) absorbs the repeat, which keeps a double-tap from inflating
 * the count.
 *
 * @param input - `liked` true stores the like, false removes it.
 * @returns The review's like state, or `null` when the review does not exist.
 */
export const setGoogleReviewLike = async (
  input: SetGoogleReviewLikeInput,
): Promise<GoogleReviewLikeState | null> => {
  return withDatabaseTransaction<GoogleReviewLikeState | null>(async (client) => {
    const reviewResult = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid
       FROM google_business_reviews
       WHERE uuid = $1::uuid
       LIMIT 1`,
      [input.reviewId],
    );

    if (!reviewResult.rows[0]) {
      return { transaction: 'rollback', value: null };
    }

    if (input.liked) {
      await client.query(
        `INSERT INTO google_review_likes (
           google_business_review_uuid,
           reviewer_uuid
         )
         VALUES ($1::uuid, $2::uuid)
         ON CONFLICT (google_business_review_uuid, reviewer_uuid) DO NOTHING`,
        [input.reviewId, input.reviewerId],
      );
    } else {
      await client.query(
        `DELETE FROM google_review_likes
         WHERE google_business_review_uuid = $1::uuid
           AND reviewer_uuid = $2::uuid`,
        [input.reviewId, input.reviewerId],
      );
    }

    const stateResult = await client.query<GoogleReviewLikeStateRow>(
      `SELECT
         (SELECT count(*)
            FROM google_review_likes
            WHERE google_business_review_uuid = $1::uuid)::int AS like_count,
         EXISTS (SELECT 1
            FROM google_review_likes
            WHERE google_business_review_uuid = $1::uuid
              AND reviewer_uuid = $2::uuid) AS viewer_has_liked`,
      [input.reviewId, input.reviewerId],
    );

    const state = stateResult.rows[0];
    if (!state) {
      throw new Error('Google review like state query returned no row');
    }

    return {
      transaction: 'commit',
      value: {
        reviewId: input.reviewId,
        likeCount: state.like_count,
        viewerHasLiked: state.viewer_has_liked,
      },
    };
  });
};
