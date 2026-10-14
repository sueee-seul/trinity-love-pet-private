import { z } from 'zod';

/**
 * In-app notices about booking requests, stored in the existing `notification` table (no column
 * was added). A parent notice is linked to its owner through `pet_owners_notification`; a manager
 * notice carries the manager in `notification.assignee_uuid`, as the Google Review notices do.
 * Mirrored by Frontend/src/features/pet-parent/types/notifications.ts (parent side) and
 * Frontend/src/features/admin/types/googleReviewNotification.ts (manager side).
 */

/** `notification.category` of every booking notice, for parents and managers alike. */
export const BOOKING_NOTIFICATION_CATEGORY = 'booking' as const;

/** What happened to a parent's request. Stored in `notification.notification_setting`. */
export const PARENT_BOOKING_NOTIFICATION_KINDS = [
  'booking_request_received',
  'booking_approved',
  'booking_refused',
  'booking_back_in_review',
  // Changes the parent made while the pet was staying; each doubles as the receipt in the email.
  'booking_extended',
  'booking_add_on_booked',
  'booking_times_changed',
  // Sent without the parent asking: the day's update, the report at check-out, and the short
  // "settled in" note on the check-in day.
  'booking_daily_update',
  'booking_stay_report',
  'booking_arrival_note',
  // The parent cancelled or withdrew the booking themselves; the notice is their receipt.
  'booking_cancelled_by_parent',
  // No longer sent: early pick-up and pick-up coordination were removed on 7 Oct 2026 at the
  // owner's request. Kept so the notices already in a parent's bell still have a title.
  'booking_picked_up_early',
  'booking_picked_up',
  'booking_late_pickup_charged',
] as const;

export type ParentBookingNotificationKind = (typeof PARENT_BOOKING_NOTIFICATION_KINDS)[number];

/** The manager's "New booking request" notice. Stored in `notification.notification_setting`. */
export const MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE = 'booking_request_created' as const;

/**
 * Flags the booking jobs and the desk raise for managers: one row per active manager, linked by
 * `notification.booking_uuid`, so each manager sees it once and can mark it read. Stored in
 * `notification.notification_setting`; the admin bookings page reads them by these values.
 */

/** The card could not be held 48 hours before drop-off; the guest was asked for another card. */
export const BOOKING_CARD_HOLD_FAILED = 'booking_card_hold_failed' as const;

/** The drop-off day has passed and nobody recorded how each pet's arrival went. */
export const BOOKING_ARRIVAL_UNMARKED = 'booking_arrival_unmarked' as const;

/** A manager moved a stay without a charge; the notice keeps their reason. */
export const BOOKING_MOVED_BY_STAFF = 'booking_moved_by_staff' as const;

/**
 * A request's 24-hour review ends within 4 hours. Shown in the manager bell as "Decision due
 * soon"; after the deadline the request is released and nothing is charged.
 */
export const BOOKING_REVIEW_DUE = 'booking_review_due' as const;

/** The parent changed a stay under way (extended it, booked an add-on, moved a time). */
export const BOOKING_CHANGED_BY_GUEST = 'booking_changed_by_guest' as const;

/** A dose on the pet's record passed its window with no tick (Scenario 11: flag it at once). */
export const BOOKING_MEDICATION_OVERDUE = 'booking_medication_overdue' as const;

/** Something needs a person: an escalation with its summary, suggested step and reply-by time. */
export const BOOKING_ESCALATION = 'booking_escalation' as const;

/**
 * The parent said they were on their way. No longer raised since pick-up coordination was removed
 * on 7 Oct 2026; kept so the notices already in a manager's bell are still listed.
 */
export const BOOKING_PARENT_ON_THE_WAY = 'booking_parent_on_the_way' as const;

export type BookingNotificationSetting =
  | typeof BOOKING_CARD_HOLD_FAILED
  | typeof BOOKING_ARRIVAL_UNMARKED
  | typeof BOOKING_MOVED_BY_STAFF
  | typeof BOOKING_REVIEW_DUE
  | typeof BOOKING_CHANGED_BY_GUEST
  | typeof BOOKING_MEDICATION_OVERDUE
  | typeof BOOKING_ESCALATION
  | typeof BOOKING_PARENT_ON_THE_WAY;

/** A stay's Auckland calendar days, as "YYYY-MM-DD". */
export interface NoticeStayDates {
  start: string;
  end: string;
}

/**
 * Why a manager checked a pet first. `medication` is the only reason today; the others were the
 * reasons before 6 October 2026 and still appear in older notices.
 */
export type NoticeReviewReason =
  'medication' | 'behaviour_or_health' | 'first_stay' | 'long_stay' | 'other';

/**
 * What a notice says, read back from its sentence, so a page in another language can say it in
 * its own words. Pet names are an empty list when the stay had no named pet.
 */
export type ParentNoticeFacts =
  | { template: 'confirmed'; reference: string; pets: string[]; dates: NoticeStayDates | null }
  | {
      template: 'received';
      reference: string;
      dates: NoticeStayDates | null;
      confirmed: string[];
      waiting: { name: string; reasons: NoticeReviewReason[] }[];
    }
  | { template: 'approved'; pets: string[]; dates: NoticeStayDates | null }
  | { template: 'refused'; pets: string[]; dates: NoticeStayDates | null; reason: string | null }
  | { template: 'reopened'; pets: string[]; dates: NoticeStayDates | null }
  | { template: 'moved'; pets: string[]; dates: NoticeStayDates | null };

export interface ParentNotification {
  id: string;
  kind: ParentBookingNotificationKind;
  title: string;
  body: string;
  /** Null when the sentence is not one the notices write (it is then shown as written). */
  facts: ParentNoticeFacts | null;
  createdAt: string;
  readAt: string | null;
}

/** Newest first; `unreadCount` counts every unread notice, not only the ones in `items`. */
export interface ParentNotificationList {
  items: ParentNotification[];
  unreadCount: number;
}

export interface ParentNotificationRead {
  id: string;
  readAt: string;
}

export interface ParentNotificationsReadAll {
  updatedIds: string[];
  readAt: string | null;
}

export const parentNotificationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type ParentNotificationListQuery = z.infer<typeof parentNotificationListQuerySchema>;

/**
 * `through` is the newest notice the bell has shown. Only notices up to it are marked read, so a
 * notice that arrives while the bell is open is not marked read before the parent sees it.
 */
export const parentNotificationsReadAllSchema = z
  .object({
    through: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type ParentNotificationsReadAllInput = z.infer<typeof parentNotificationsReadAllSchema>;

export interface BookingRequestNotificationTarget {
  kind: typeof BOOKING_NOTIFICATION_CATEGORY;
  bookingId: string;
}

/** One "New booking request" notice in the manager bell. */
export interface BookingRequestNotification {
  id: string;
  type: typeof MANAGER_BOOKING_REQUEST_NOTIFICATION_TYPE;
  category: typeof BOOKING_NOTIFICATION_CATEGORY;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  target: BookingRequestNotificationTarget;
}
