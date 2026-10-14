import {
  createGoogleBusinessReviewRecord,
  deleteMockGoogleBusinessReviewRecord,
  findGoogleBusinessReviewPage,
  type CreatedReviewRecord,
  type GoogleBusinessReviewPageRecord,
} from '../repositories/review.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { ReviewerService, type ReviewerProfile } from './reviewer.service.js';
import type { ReviewSubmission, SimulatorReviewSubmission } from '../contracts/review.contract.js';
import {
  removeReviewPhotos,
  resolveReviewPhotoUrls,
  saveReviewPhotos,
} from './review.photo.storage.js';
import { publishGoogleReviewEvent } from './google.review.events.js';
import { setGoogleReviewLike } from '../repositories/review.like.repository.js';
import type { GoogleReviewLikeState } from '../contracts/google.review.like.contract.js';

const PETHOUSE_REVIEW_PLACE_SLUG = 'PetHouse';

export interface PublicReview {
  id: string;
  reviewerId: string;
  placeSlug: string;
  rating: number;
  reviewText: string | null;
  source: 'human' | 'simulator';
  serviceUserMatchStatus: 'pending';
  createdAt: string;
}

export interface PublicRatingBreakdown {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
}

export interface PublicGoogleBusinessReview {
  id: string;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  reviewerIsAnonymous: boolean | null;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
  ownerReply: string | null;
  ownerReplyUpdatedAt: string | null;
  photoUrls: string[];
  /** Total likes from every reviewer. Readable while signed out. */
  likeCount: number;
  /** False for an anonymous request, which has no reviewer identity to match. */
  viewerHasLiked: boolean;
}

export interface PublicReviewPage {
  location: {
    id: string;
    displayName: string;
    formattedAddress: string | null;
    googleMapsUri: string | null;
    averageRating: number | null;
    totalReviews: number;
    ratingBreakdown: PublicRatingBreakdown[];
  };
  reviews: PublicGoogleBusinessReview[];
}

const toPublicReview = (review: CreatedReviewRecord): PublicReview => ({
  id: review.id,
  reviewerId: review.reviewer_id,
  placeSlug: review.place_slug,
  rating: review.rating,
  reviewText: review.review_text,
  source: review.source,
  serviceUserMatchStatus: review.service_user_match_status,
  createdAt: review.created_at.toISOString(),
});

const RATING_VALUES: readonly PublicRatingBreakdown['stars'][] = [5, 4, 3, 2, 1];

const toPublicGoogleBusinessReview = async (
  review: GoogleBusinessReviewPageRecord['reviews'][number],
): Promise<PublicGoogleBusinessReview> => ({
  id: review.id,
  reviewerName: review.reviewer_is_anonymous
    ? 'Anonymous reviewer'
    : (review.reviewer_display_name ?? 'Google reviewer'),
  reviewerAvatarUrl: review.reviewer_is_anonymous ? null : review.reviewer_profile_photo_url,
  reviewerIsAnonymous: review.reviewer_is_anonymous,
  rating: review.rating,
  reviewText: review.comment,
  createdAt: review.google_created_at.toISOString(),
  updatedAt: review.google_updated_at.toISOString(),
  ownerReply: review.owner_reply,
  ownerReplyUpdatedAt: review.owner_reply_updated_at?.toISOString() ?? null,
  photoUrls: await resolveReviewPhotoUrls(review.photo_urls ?? []),
  likeCount: review.like_count,
  viewerHasLiked: review.viewer_has_liked,
});

const toPublicReviewPage = async (
  page: GoogleBusinessReviewPageRecord,
): Promise<PublicReviewPage> => {
  const ratingBreakdown = RATING_VALUES.map((stars) => ({
    stars,
    count: page.reviews.filter((review) => review.rating === stars).length,
  }));
  const totalLoadedReviews = page.reviews.length;
  const totalReviews =
    page.location.user_rating_count > 0 ? page.location.user_rating_count : totalLoadedReviews;
  const averageRating =
    page.location.aggregate_rating ??
    (totalLoadedReviews > 0
      ? page.reviews.reduce((sum, review) => sum + review.rating, 0) / totalLoadedReviews
      : null);

  return {
    location: {
      id: page.location.id,
      displayName: page.location.display_name,
      formattedAddress: page.location.formatted_address,
      googleMapsUri: page.location.google_maps_uri,
      averageRating,
      totalReviews,
      ratingBreakdown,
    },
    reviews: await Promise.all(page.reviews.map(toPublicGoogleBusinessReview)),
  };
};

export class ReviewService {
  /**
   * Loads the public review page.
   *
   * @param viewerReviewerId - Signed-in reviewer, or null for an anonymous visitor.
   *   Anonymous visitors still receive every like count; only the per-viewer
   *   `viewerHasLiked` flag needs an identity.
   */
  static async getGoogleReviewPage(
    placeSlug: string,
    viewerReviewerId: string | null = null,
  ): Promise<PublicReviewPage | null> {
    const page = await findGoogleBusinessReviewPage(placeSlug, viewerReviewerId);
    return page ? toPublicReviewPage(page) : null;
  }

  /**
   * Stores or removes one reviewer's like on a review.
   *
   * The caller must already be an authenticated reviewer: a like is attributed to a
   * reviewer identity, so this never runs for an anonymous visitor. Repeating the same
   * request is safe and leaves the count unchanged.
   *
   * @param liked - True to like, false to remove an existing like.
   */
  static async setReviewLike(
    reviewerId: string,
    reviewId: string,
    liked: boolean,
  ): Promise<GoogleReviewLikeState> {
    const likeState = await setGoogleReviewLike({ reviewId, reviewerId, liked });
    if (!likeState) {
      throw new AppError('Review not found', 'NOT_FOUND', 404);
    }

    return likeState;
  }

  static async createHumanReview(
    reviewer: ReviewerProfile,
    input: ReviewSubmission,
    files: Express.Multer.File[] | Express.Multer.File | undefined = undefined,
  ): Promise<PublicReview> {
    const reviewText = input.reviewText || null;
    const photos = Array.isArray(files) ? files : files ? [files] : [];
    const photoUrls = await saveReviewPhotos(photos);
    try {
      const review = await createGoogleBusinessReviewRecord({
        reviewerId: reviewer.id,
        reviewerDisplayName: reviewer.displayName,
        reviewerAvatarUrl: reviewer.avatarUrl,
        placeSlug: input.placeSlug,
        rating: input.rating,
        reviewText,
        photoUrls,
        notifyActiveManagers: true,
      });

      publishGoogleReviewEvent({
        target: 'both',
        placeSlug: review.place_slug,
        changeType: 'created',
      });
      return toPublicReview(review);
    } catch (error: unknown) {
      await removeReviewPhotos(photoUrls);
      throw error;
    }
  }

  static async createSimulatorReview(input: SimulatorReviewSubmission): Promise<PublicReview> {
    const reviewer = await ReviewerService.upsertSimulatorReviewer({
      authorKey: input.authorKey,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      email: input.email ?? null,
    });

    const review = await createGoogleBusinessReviewRecord({
      reviewerId: reviewer.id,
      reviewerDisplayName: reviewer.displayName,
      reviewerAvatarUrl: reviewer.avatarUrl,
      placeSlug: input.placeSlug,
      rating: input.rating,
      reviewText: input.reviewText || null,
      photoUrls: [],
      notifyActiveManagers: false,
    });

    return toPublicReview({ ...review, source: 'simulator' });
  }

  static async deleteMockGoogleBusinessReview(reviewId: string): Promise<void> {
    const deleted = await deleteMockGoogleBusinessReviewRecord(reviewId);
    if (!deleted) {
      throw new AppError('Review not found', 'NOT_FOUND', 404);
    }
    await removeReviewPhotos(deleted.photoUrls);
    publishGoogleReviewEvent({
      target: 'both',
      placeSlug: PETHOUSE_REVIEW_PLACE_SLUG,
      changeType: 'deleted',
    });
  }
}
