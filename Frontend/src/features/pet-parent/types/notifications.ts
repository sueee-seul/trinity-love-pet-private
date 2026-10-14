/**
 * The parent bell's notices about booking requests. Mirrors
 * Backend/src/contracts/booking.notification.contract.ts.
 */

export const PARENT_NOTIFICATION_KINDS = [
  'booking_request_received',
  'booking_approved',
  'booking_refused',
  'booking_back_in_review',
  // Changes the parent made while the pet was staying; each doubles as the receipt in the email.
  'booking_extended',
  'booking_picked_up_early',
  'booking_add_on_booked',
  'booking_times_changed',
  // Sent without the parent asking: the day's update, and the report at pick-up.
  'booking_daily_update',
  'booking_stay_report',
  // The short "settled in" note on the drop-off day, with the first photo when there is one.
  'booking_arrival_note',
  // The parent cancelled or withdrew the booking themselves; the notice is their receipt.
  'booking_cancelled_by_parent',
  // The desk recorded who collected the pet, and the extra night when that came after the cut-off.
  'booking_picked_up',
  'booking_late_pickup_charged',
] as const;

export type ParentNotificationKind = (typeof PARENT_NOTIFICATION_KINDS)[number];

/** A stay's Auckland calendar days, as "YYYY-MM-DD". */
export interface NoticeStayDates {
  start: string;
  end: string;
}

/** Why a manager checked a pet first; all but `medication` appear only in older notices. */
export type NoticeReviewReason =
  'medication' | 'behaviour_or_health' | 'first_stay' | 'long_stay' | 'other';

/** What a notice says, read back from its English sentence by the server. */
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
  kind: ParentNotificationKind;
  /** Written by the server when the event happened; the stay page shows the live status. */
  title: string;
  body: string;
  /** Null when the sentence is not one the notices write. */
  facts: ParentNoticeFacts | null;
  /** ISO timestamp. */
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
