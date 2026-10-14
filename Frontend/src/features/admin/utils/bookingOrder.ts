import type { ManagerBookingRecord, ManagerBookingTab } from '../types/booking';
import { aucklandDateOf } from './bookingDesk';

/** Tabs whose cards are ordered by the nearest check-in date. */
const DATE_ORDERED_TABS: ReadonlySet<ManagerBookingTab> = new Set(['Booking', 'Approve']);

/** A request still waiting for review this many days or fewer before check-in is urgent. */
export const URGENT_REVIEW_DAYS = 3;

const DAY_MS = 86_400_000;

/** Whole days from today (Auckland) to the check-in date; negative once it has passed. */
export const daysUntilCheckIn = (record: ManagerBookingRecord, now: Date): number | null => {
  const checkIn = record.booking.dates.check_in;
  if (checkIn === null) {
    return null;
  }
  const today = aucklandDateOf(now);
  return Math.round(
    (Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS,
  );
};

export const isUrgentReview = (record: ManagerBookingRecord, now: Date): boolean => {
  const days = daysUntilCheckIn(record, now);
  return (
    record.booking.manager_review_status === 'pending' &&
    days !== null &&
    days <= URGENT_REVIEW_DAYS
  );
};

/**
 * Upcoming check-ins first (soonest first), then past ones (most recent first), then bookings with
 * no date. Pets of one booking share a date and stay together.
 */
const byNearestCheckIn =
  (today: string) =>
  (a: ManagerBookingRecord, b: ManagerBookingRecord): number => {
    const aDate = a.booking.dates.check_in;
    const bDate = b.booking.dates.check_in;
    if (aDate === null || bDate === null) {
      return aDate === bDate ? a.booking_id.localeCompare(b.booking_id) : aDate === null ? 1 : -1;
    }
    const aUpcoming = aDate >= today;
    const bUpcoming = bDate >= today;
    if (aUpcoming !== bUpcoming) {
      return aUpcoming ? -1 : 1;
    }
    const byDate = aUpcoming ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    return byDate || a.booking_id.localeCompare(b.booking_id);
  };

/** Cards in the order a tab shows them; tabs other than the two above keep the loaded order. */
export const orderBookingsForTab = (
  records: readonly ManagerBookingRecord[],
  tab: ManagerBookingTab,
  now: Date,
): ManagerBookingRecord[] =>
  DATE_ORDERED_TABS.has(tab)
    ? [...records].sort(byNearestCheckIn(aucklandDateOf(now)))
    : [...records];
