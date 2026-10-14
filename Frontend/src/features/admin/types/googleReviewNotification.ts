export const GOOGLE_REVIEW_NOTIFICATION_CATEGORY = 'google_review' as const;
export const GOOGLE_REVIEW_NOTIFICATION_TYPE = 'google_review_created' as const;
export const BOOKING_NOTIFICATION_CATEGORY = 'booking' as const;
export const BOOKING_REQUEST_NOTIFICATION_TYPE = 'booking_request_created' as const;

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
  target: {
    kind: typeof GOOGLE_REVIEW_NOTIFICATION_CATEGORY;
    reviewId: string;
    placeSlug: string;
  };
}

/** "New booking request". Mirrors Backend/src/contracts/booking.notification.contract.ts. */
export interface BookingRequestNotification {
  id: string;
  type: typeof BOOKING_REQUEST_NOTIFICATION_TYPE;
  category: typeof BOOKING_NOTIFICATION_CATEGORY;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  target: {
    kind: typeof BOOKING_NOTIFICATION_CATEGORY;
    bookingId: string;
  };
}

/** Everything the manager bell lists. */
export type ManagerNotification = GoogleReviewNotification | BookingRequestNotification;

export interface GoogleReviewNotificationPage {
  items: ManagerNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface UpdatedGoogleReviewNotification {
  id: string;
  readAt: string;
}

export interface ReadAllGoogleReviewNotificationsResult {
  updatedIds: string[];
  readAt: string | null;
}
