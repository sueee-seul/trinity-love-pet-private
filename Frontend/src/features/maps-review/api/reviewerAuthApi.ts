import { API_BASE_URL } from '../../../shared/api';
import type { RatingStarCount, ReviewPageData } from '../types/reviewTypes';

export interface ReviewLikeState {
  reviewId: string;
  likeCount: number;
  viewerHasLiked: boolean;
}

const GOOGLE_REVIEWS_API_PATH = `${API_BASE_URL}/google-reviews`;

/** The authenticated reviewer projection used by the Maps-review auth boundary. */
export interface ReviewerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

/** Form data payload used to submit a new Google Review. */
export interface ReviewSubmission {
  placeSlug: string;
  rating: number;
  reviewText?: string;
}

/** Represents a collection of image files selected for a review. */
export type ReviewPhotoFiles = ReadonlyArray<File>;

/**
 * Result wrapper used by the Maps-review API endpoints.
 *
 * @remarks
 * Encapsulates success, validated data, and optional server error messages,
 * ensuring the caller receives predictable failures rather than throwing on
 * every non-2xx response.
 */
export interface ReviewerApiResult<T> {
  ok: boolean;
  data: T | null;
  message?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isReviewerProfile = (value: unknown): value is ReviewerProfile => {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.displayName === 'string' &&
    value.displayName.trim().length > 0 &&
    (value.avatarUrl === undefined ||
      value.avatarUrl === null ||
      typeof value.avatarUrl === 'string')
  );
};

const isRatingStarCount = (value: unknown): value is RatingStarCount =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

const isReviewPageData = (value: unknown): value is ReviewPageData => {
  if (!isRecord(value) || !isRecord(value.location) || !Array.isArray(value.reviews)) {
    return false;
  }

  const location = value.location;
  return (
    typeof location.id === 'string' &&
    typeof location.displayName === 'string' &&
    (location.formattedAddress === null || typeof location.formattedAddress === 'string') &&
    (location.googleMapsUri === null || typeof location.googleMapsUri === 'string') &&
    (location.averageRating === null || typeof location.averageRating === 'number') &&
    typeof location.totalReviews === 'number' &&
    Array.isArray(location.ratingBreakdown) &&
    location.ratingBreakdown.every(
      (row) => isRecord(row) && isRatingStarCount(row.stars) && typeof row.count === 'number',
    ) &&
    value.reviews.every(
      (review) =>
        isRecord(review) &&
        typeof review.id === 'string' &&
        typeof review.reviewerName === 'string' &&
        (review.reviewerAvatarUrl === null || typeof review.reviewerAvatarUrl === 'string') &&
        (review.reviewerIsAnonymous === null || typeof review.reviewerIsAnonymous === 'boolean') &&
        isRatingStarCount(review.rating) &&
        (review.reviewText === null || typeof review.reviewText === 'string') &&
        Array.isArray(review.photoUrls) &&
        review.photoUrls.every((photoUrl) => typeof photoUrl === 'string') &&
        typeof review.createdAt === 'string' &&
        typeof review.updatedAt === 'string' &&
        (review.ownerReply === null || typeof review.ownerReply === 'string') &&
        (review.ownerReplyUpdatedAt === null || typeof review.ownerReplyUpdatedAt === 'string') &&
        typeof review.likeCount === 'number' &&
        typeof review.viewerHasLiked === 'boolean',
    )
  );
};

const getResponseMessage = (body: unknown): string | undefined => {
  if (!isRecord(body)) {
    return undefined;
  }

  if (typeof body.msg === 'string') {
    return body.msg;
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  if (typeof body.error === 'string') {
    return body.error;
  }

  if (isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }

  return undefined;
};

const getResponseData = (body: unknown): unknown => {
  if (isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'data')) {
    return body.data;
  }

  return body;
};

const readResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const toResult = <T>(response: Response, body: unknown, data: T | null): ReviewerApiResult<T> => {
  return {
    ok: response.ok,
    data,
    message: getResponseMessage(body),
  };
};

const getProfileResult = (
  response: Response,
  body: unknown,
): ReviewerApiResult<ReviewerProfile> => {
  const responseData = getResponseData(body);
  const profile = isRecord(responseData) ? responseData.reviewer : undefined;
  if (!response.ok) {
    return toResult<ReviewerProfile>(response, body, null);
  }

  if (!isReviewerProfile(profile)) {
    throw new Error('Invalid reviewer authentication response');
  }

  return toResult(response, body, profile);
};

/**
 * API client for the public Maps-review surface and reviewer identity.
 *
 * @remarks
 * Maps-review auth relies on HTTP-only cookies and is independent of the employee
 * auth boundary. Responses are runtime-validated; malformed success payloads
 * throw instead of silently returning partial data.
 */
const isReviewLikeState = (value: unknown): value is ReviewLikeState => {
  return (
    isRecord(value) &&
    typeof value.reviewId === 'string' &&
    typeof value.likeCount === 'number' &&
    typeof value.viewerHasLiked === 'boolean'
  );
};

export const reviewerAuthApi = {
  /** Hydrates the reviewer session using current HTTP-only cookies. */
  getCurrentReviewer: async (): Promise<ReviewerApiResult<ReviewerProfile>> => {
    const response = await fetch(`${API_BASE_URL}/review-auth/me`, {
      credentials: 'include',
    });
    const body = await readResponse(response);
    return getProfileResult(response, body);
  },

  /** Completes the Google OAuth flow and sets the reviewer session cookie. */
  loginWithGoogleCode: async (
    authorizationCode: string,
  ): Promise<ReviewerApiResult<ReviewerProfile>> => {
    const response = await fetch(`${API_BASE_URL}/review-auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ authorizationCode }),
    });
    const body = await readResponse(response);
    return getProfileResult(response, body);
  },

  /** Clears the reviewer session cookie and returns a logout confirmation. */
  logout: async (): Promise<ReviewerApiResult<unknown>> => {
    const response = await fetch(`${API_BASE_URL}/review-auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await readResponse(response);
    return toResult(response, body, response.ok ? getResponseData(body) : null);
  },

  /** Submits a new review payload with optional photos for the specified place. */
  submitReview: async (
    payload: ReviewSubmission,
    photos: ReviewPhotoFiles = [],
  ): Promise<ReviewerApiResult<unknown>> => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    photos.forEach((photo) => formData.append('photos', photo));
    const response = await fetch(GOOGLE_REVIEWS_API_PATH, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const body = await readResponse(response);
    return toResult(response, body, response.ok ? getResponseData(body) : null);
  },

  /** Deletes the reviewer's own review by ID. */
  deleteReview: async (reviewId: string): Promise<ReviewerApiResult<unknown>> => {
    const response = await fetch(`${GOOGLE_REVIEWS_API_PATH}/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
    });
    const body = await readResponse(response);
    return toResult(response, body, response.ok ? getResponseData(body) : null);
  },

  /**
   * Stores or removes the signed-in reviewer's like on one review.
   *
   * This changes stored data and requires a reviewer session; a signed-out caller gets a
   * 401 result rather than a thrown error, so the caller can send them to sign in.
   *
   * @param liked - True to like, false to remove an existing like.
   * @returns The review's like state after the change, or null when the request failed.
   */
  setReviewLike: async (
    reviewId: string,
    liked: boolean,
  ): Promise<ReviewerApiResult<ReviewLikeState>> => {
    const response = await fetch(
      `${GOOGLE_REVIEWS_API_PATH}/${encodeURIComponent(reviewId)}/like`,
      { method: liked ? 'PUT' : 'DELETE', credentials: 'include' },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      return toResult<ReviewLikeState>(response, body, null);
    }

    const responseData = getResponseData(body);
    const likeState = isRecord(responseData) ? responseData.like : undefined;
    if (!isReviewLikeState(likeState)) {
      throw new Error('Invalid review like response');
    }

    return toResult(response, body, likeState);
  },

  /** Loads and validates the public mock location and review list. */
  getReviewPage: async (placeSlug: string): Promise<ReviewerApiResult<ReviewPageData>> => {
    const response = await fetch(
      `${GOOGLE_REVIEWS_API_PATH}?placeSlug=${encodeURIComponent(placeSlug)}`,
      { credentials: 'include' },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      return toResult<ReviewPageData>(response, body, null);
    }

    const responseData = getResponseData(body);
    if (!isReviewPageData(responseData)) {
      throw new Error('Invalid review page response');
    }

    return toResult(response, body, responseData);
  },
};
