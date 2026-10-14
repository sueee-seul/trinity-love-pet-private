import { API_BASE_URL } from '../../../shared/api';
import {
  GOOGLE_REVIEW_TRIAGE_TYPES,
  type AdminGoogleReview,
  type AdminGoogleReviewPage,
} from '../types/googleReview';

const ADMIN_GOOGLE_REVIEWS_API_PATH = `${API_BASE_URL}/admin/google-reviews`;

export interface GoogleReviewsApiResult<T> {
  ok: boolean;
  data: T | null;
  message?: string;
}

export interface UpdateGoogleReviewTypeInput {
  triageType: Exclude<AdminGoogleReview['triageType'], null>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isRating = (value: unknown): value is AdminGoogleReview['rating'] => {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
};

const isTriageType = (value: unknown): value is AdminGoogleReview['triageType'] => {
  return value === null || GOOGLE_REVIEW_TRIAGE_TYPES.some((type) => type === value);
};

const isAdminGoogleReview = (value: unknown): value is AdminGoogleReview => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.reviewerName === 'string' &&
    (value.reviewerEmail === null || typeof value.reviewerEmail === 'string') &&
    (value.reviewerAvatarUrl === null || typeof value.reviewerAvatarUrl === 'string') &&
    (value.reviewerIsAnonymous === null || typeof value.reviewerIsAnonymous === 'boolean') &&
    isRating(value.rating) &&
    (value.reviewText === null || typeof value.reviewText === 'string') &&
    Array.isArray(value.photoUrls) &&
    value.photoUrls.every((photoUrl) => typeof photoUrl === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.ownerReply === null || typeof value.ownerReply === 'string') &&
    (value.ownerReplyUpdatedAt === null || typeof value.ownerReplyUpdatedAt === 'string') &&
    isTriageType(value.triageType) &&
    typeof value.isRead === 'boolean' &&
    typeof value.currentStatus === 'string' &&
    (value.assignedEmployeeUuid === null || typeof value.assignedEmployeeUuid === 'string')
  );
};

const isAdminGoogleReviewPage = (value: unknown): value is AdminGoogleReviewPage => {
  return (
    isRecord(value) && Array.isArray(value.reviews) && value.reviews.every(isAdminGoogleReview)
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
  if (isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message;
  }
  return undefined;
};

const getResponseData = (body: unknown): unknown => {
  return isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
};

const readResponse = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/** Validates employee review projections and manager review mutations at the API boundary. */
export const googleReviewsApi = {
  getReviews: async (placeSlug: string): Promise<GoogleReviewsApiResult<AdminGoogleReviewPage>> => {
    const response = await fetch(
      `${ADMIN_GOOGLE_REVIEWS_API_PATH}?placeSlug=${encodeURIComponent(placeSlug)}`,
      { credentials: 'include' },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      return { ok: false, data: null, message: getResponseMessage(body) };
    }

    const responseData = getResponseData(body);
    if (!isAdminGoogleReviewPage(responseData)) {
      throw new Error('Invalid admin Google reviews response');
    }

    return { ok: true, data: responseData, message: getResponseMessage(body) };
  },

  replyToGoogleReview: async (reviewId: string, replyBody: string): Promise<AdminGoogleReview> => {
    const response = await fetch(
      `${ADMIN_GOOGLE_REVIEWS_API_PATH}/${encodeURIComponent(reviewId)}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ replyBody }),
      },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(getResponseMessage(body) ?? 'Google review reply could not be saved.');
    }

    const responseData = getResponseData(body);
    if (!isAdminGoogleReview(responseData)) {
      throw new Error('Invalid Google review reply response');
    }

    return responseData;
  },

  updateReviewType: async (
    reviewId: string,
    triageType: UpdateGoogleReviewTypeInput['triageType'],
  ): Promise<AdminGoogleReview> => {
    const response = await fetch(
      `${ADMIN_GOOGLE_REVIEWS_API_PATH}/${encodeURIComponent(reviewId)}/type`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ triageType }),
      },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(getResponseMessage(body) ?? 'Google review type could not be saved.');
    }

    const responseData = getResponseData(body);
    if (!isAdminGoogleReview(responseData)) {
      throw new Error('Invalid Google review type response');
    }

    return responseData;
  },
};
