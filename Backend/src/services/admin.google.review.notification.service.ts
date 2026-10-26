import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
  GOOGLE_REVIEW_NOTIFICATION_TYPE,
  googleReviewNotificationQuerySchema,
  type GoogleReviewNotification,
  type GoogleReviewNotificationPage,
  type GoogleReviewNotificationQuery,
  type ManagerNotification,
} from '../contracts/google.review.notification.contract.js';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
  type BookingRequestNotification,
} from '../contracts/booking.notification.contract.js';
import {
  findManagerGoogleReviewNotifications,
  markAllManagerGoogleReviewNotificationsRead,
  markManagerGoogleReviewNotificationRead,
  type BookingRequestNotificationRecord,
  type GoogleReviewNotificationCursor,
  type GoogleReviewNotificationRecord,
  type ManagerNotificationRecord,
} from '../repositories/admin.google.review.notification.repository.js';
import {
  MANAGER_BOOKING_REQUEST_TITLE,
  MANAGER_BOOKING_TITLES,
} from './booking.notification.messages.js';

const NOTIFICATION_PLACE_SLUG = 'PetHouse';
const notificationCursorSchema = z.object({
  createdAt: z.string().datetime(),
  uuid: z.string().uuid(),
});

const encodeCursor = (record: ManagerNotificationRecord): string =>
  Buffer.from(
    JSON.stringify({ createdAt: record.created_at.toISOString(), uuid: record.uuid }),
  ).toString('base64url');

const decodeCursor = (value: string | undefined): GoogleReviewNotificationCursor | null => {
  if (!value) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new AppError('Notification cursor is invalid', 'INVALID_NOTIFICATION_CURSOR', 400);
  }

  const parsed = notificationCursorSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new AppError('Notification cursor is invalid', 'INVALID_NOTIFICATION_CURSOR', 400);
  }

  return { createdAt: new Date(parsed.data.createdAt), uuid: parsed.data.uuid };
};

const getReviewerName = (reviewerName: string | null): string => {
  const trimmedName = reviewerName?.trim() ?? '';
  return trimmedName.length > 0 ? trimmedName : 'Google reviewer';
};

const toGoogleReviewNotification = (
  record: GoogleReviewNotificationRecord,
): GoogleReviewNotification => {
  const reviewerName = getReviewerName(record.reviewer_display_name);
  return {
    id: record.uuid,
    type: GOOGLE_REVIEW_NOTIFICATION_TYPE,
    category: GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
    title: `New review from ${reviewerName}`,
    body: `${record.rating} stars · ${NOTIFICATION_PLACE_SLUG}`,
    reviewerName,
    rating: record.rating,
    createdAt: record.created_at.toISOString(),
    readAt: record.read_at?.toISOString() ?? null,
    target: {
      kind: GOOGLE_REVIEW_NOTIFICATION_CATEGORY,
      reviewId: record.review_uuid,
      placeSlug: NOTIFICATION_PLACE_SLUG,
    },
  };
};

const toBookingRequestNotification = (
  record: BookingRequestNotificationRecord,
): BookingRequestNotification => ({
  id: record.uuid,
  type: MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE,
  category: BOOKING_NOTIFICATION_CATEGORY,
  title: MANAGER_BOOKING_TITLES[record.notification_setting] ?? MANAGER_BOOKING_REQUEST_TITLE,
  body: record.summary_content ?? '',
  createdAt: record.created_at.toISOString(),
  readAt: record.read_at?.toISOString() ?? null,
  target: { kind: BOOKING_NOTIFICATION_CATEGORY, bookingId: record.booking_uuid },
});

const toNotification = (record: ManagerNotificationRecord): ManagerNotification =>
  record.category === BOOKING_NOTIFICATION_CATEGORY
    ? toBookingRequestNotification(record)
    : toGoogleReviewNotification(record);

/** Loads the authenticated manager's notification dropdown: Google Reviews and booking requests. */
export const getManagerGoogleReviewNotifications = async (
  managerUuid: string,
  query: GoogleReviewNotificationQuery,
): Promise<GoogleReviewNotificationPage> => {
  const cursor = decodeCursor(query.cursor);
  const result = await findManagerGoogleReviewNotifications(managerUuid, query.limit, cursor);
  const items = result.items.map(toNotification);
  const lastRecord = result.items.at(-1);

  return {
    items,
    unreadCount: result.unreadCount,
    nextCursor: result.hasMore && lastRecord ? encodeCursor(lastRecord) : null,
  };
};

export const parseGoogleReviewNotificationQuery = (query: unknown): GoogleReviewNotificationQuery =>
  googleReviewNotificationQuerySchema.parse(query);

export const markManagerGoogleReviewNotificationAsRead = async (
  notificationUuid: string,
  managerUuid: string,
): Promise<{ id: string; readAt: string }> => {
  const result = await markManagerGoogleReviewNotificationRead(notificationUuid, managerUuid);
  if (!result) {
    throw new AppError('Notification not found', 'NOTIFICATION_NOT_FOUND', 404);
  }

  return { id: result.uuid, readAt: result.read_at.toISOString() };
};

export const readAllManagerGoogleReviewNotifications = async (
  managerUuid: string,
): Promise<{ updatedIds: string[]; readAt: string | null }> => {
  const updated = await markAllManagerGoogleReviewNotificationsRead(managerUuid);
  return {
    updatedIds: updated.map((notification) => notification.uuid),
    readAt: updated[0]?.read_at.toISOString() ?? null,
  };
};
