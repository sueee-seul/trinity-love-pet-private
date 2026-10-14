import { API_BASE_URL } from '../../../shared/api';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  BOOKING_REQUEST_NOTIFICATION_TYPE,
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  GOOGLE_REVIEW_NOTIFICATION_TYPE,
  type BookingRequestNotification,
  type GoogleReviewNotification,
  type GoogleReviewNotificationPage,
  type ManagerNotification,
  type ReadAllGoogleReviewNotificationsResult,
  type UpdatedGoogleReviewNotification,
} from '../types/googleReviewNotification';

const GOOGLE_REVIEW_NOTIFICATIONS_API_PATH = `${API_BASE_URL}/admin/google-review-notifications`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGoogleReviewNotification = (value: unknown): value is GoogleReviewNotification => {
  if (!isRecord(value) || !isRecord(value.target)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.type === GOOGLE_REVIEW_NOTIFICATION_TYPE &&
    value.category === GOOGLE_REVIEW_NOTIFICATION_CATEGORY &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    typeof value.reviewerName === 'string' &&
    typeof value.rating === 'number' &&
    value.rating >= 1 &&
    value.rating <= 5 &&
    Number.isInteger(value.rating) &&
    typeof value.createdAt === 'string' &&
    (value.readAt === null || typeof value.readAt === 'string') &&
    value.target.kind === GOOGLE_REVIEW_NOTIFICATION_CATEGORY &&
    typeof value.target.reviewId === 'string' &&
    typeof value.target.placeSlug === 'string'
  );
};

const isBookingRequestNotification = (value: unknown): value is BookingRequestNotification =>
  isRecord(value) &&
  isRecord(value.target) &&
  typeof value.id === 'string' &&
  value.type === BOOKING_REQUEST_NOTIFICATION_TYPE &&
  value.category === BOOKING_NOTIFICATION_CATEGORY &&
  typeof value.title === 'string' &&
  typeof value.body === 'string' &&
  typeof value.createdAt === 'string' &&
  (value.readAt === null || typeof value.readAt === 'string') &&
  value.target.kind === BOOKING_NOTIFICATION_CATEGORY &&
  typeof value.target.bookingId === 'string';

const isNotification = (value: unknown): value is ManagerNotification =>
  isGoogleReviewNotification(value) || isBookingRequestNotification(value);

const isNotificationPage = (value: unknown): value is GoogleReviewNotificationPage => {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isNotification) &&
    typeof value.unreadCount === 'number' &&
    Number.isInteger(value.unreadCount) &&
    value.unreadCount >= 0 &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  );
};

const isUpdatedNotification = (value: unknown): value is UpdatedGoogleReviewNotification =>
  isRecord(value) && typeof value.id === 'string' && typeof value.readAt === 'string';

const isReadAllResult = (value: unknown): value is ReadAllGoogleReviewNotificationsResult =>
  isRecord(value) &&
  Array.isArray(value.updatedIds) &&
  value.updatedIds.every((id) => typeof id === 'string') &&
  (value.readAt === null || typeof value.readAt === 'string');

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

const buildError = (body: unknown, fallback: string): Error =>
  new Error(getResponseMessage(body) ?? fallback);

const buildListUrl = (limit: number, cursor: string | null): string => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }
  return `${GOOGLE_REVIEW_NOTIFICATIONS_API_PATH}?${params.toString()}`;
};

/** Loads the authenticated manager's Google Review notification projection. */
export const googleReviewNotificationsApi = {
  getNotifications: async (
    limit = 10,
    cursor: string | null = null,
  ): Promise<GoogleReviewNotificationPage> => {
    const response = await fetch(buildListUrl(limit, cursor), { credentials: 'include' });
    const body = await readResponse(response);
    if (!response.ok) {
      throw buildError(body, 'Google review notifications could not be loaded.');
    }

    const data = getResponseData(body);
    if (!isNotificationPage(data)) {
      throw new Error('Invalid Google review notification response');
    }
    return data;
  },

  markRead: async (notificationId: string): Promise<UpdatedGoogleReviewNotification> => {
    const response = await fetch(
      `${GOOGLE_REVIEW_NOTIFICATIONS_API_PATH}/${encodeURIComponent(notificationId)}/read`,
      { method: 'PATCH', credentials: 'include' },
    );
    const body = await readResponse(response);
    if (!response.ok) {
      throw buildError(body, 'Google review notification could not be marked read.');
    }

    const data = getResponseData(body);
    if (!isUpdatedNotification(data)) {
      throw new Error('Invalid Google review notification read response');
    }
    return data;
  },

  readAll: async (): Promise<ReadAllGoogleReviewNotificationsResult> => {
    const response = await fetch(`${GOOGLE_REVIEW_NOTIFICATIONS_API_PATH}/read-all`, {
      method: 'PATCH',
      credentials: 'include',
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw buildError(body, 'Google review notifications could not be marked read.');
    }

    const data = getResponseData(body);
    if (!isReadAllResult(data)) {
      throw new Error('Invalid Google review notifications read response');
    }
    return data;
  },
};
