import { z } from 'zod';
import type { BookingRequestNotification } from './booking.notification.contract.js';

export const GOOGLE_REVIEW_NOTIFICATION_CATEGORY = 'google_review' as const;
export const GOOGLE_REVIEW_NOTIFICATION_SETTING = 'google_review_created' as const;
export const GOOGLE_REVIEW_NOTIFICATION_TYPE = 'google_review_created' as const;
export const GOOGLE_REVIEW_RECEIVED_STEP = 'review_received' as const;

export const googleReviewNotificationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(10),
    cursor: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

export type GoogleReviewNotificationQuery = z.infer<typeof googleReviewNotificationQuerySchema>;

export interface GoogleReviewNotificationTarget {
  kind: typeof GOOGLE_REVIEW_NOTIFICATION_CATEGORY;
  reviewId: string;
  placeSlug: string;
}

export interface GoogleReviewNotification {
  id: string;
  type: typeof GOOGLE_REVIEW_NOTIFICATION_TYPE;
  category: typeof GOOGLE_REVIEW_NOTIFICATION_CATEGORY;
  title: string;
  body: string;
  reviewerName: string;
  rating: number;
  createdAt: string;
  readAt: string | null;
  target: GoogleReviewNotificationTarget;
}

/** The manager bell also carries "New booking request" notices (booking.notification.contract.ts). */
export type ManagerNotification = GoogleReviewNotification | BookingRequestNotification;

export interface GoogleReviewNotificationPage {
  items: ManagerNotification[];
  unreadCount: number;
  nextCursor: string | null;
}
