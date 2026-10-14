import type { CheckInOutcome, ManagerBookingRecord } from '../types/booking';

/**
 * The desk rules as the bookings page shows them, so a manager sees what a button will do before
 * pressing it. The server decides and charges (Backend booking.fee-policy.ts and
 * services/booking.check-in.ts); these must say the same thing.
 */

const AUCKLAND = 'Pacific/Auckland';

export const CHECK_IN_OUTCOMES: readonly CheckInOutcome[] = [
  'checked_in',
  'no_show',
  'wagstay_unable',
];

export const OUTCOME_LABELS: Record<CheckInOutcome, string> = {
  checked_in: 'Checked in',
  no_show: 'No-show',
  wagstay_unable: "We can't take this pet",
};

const aucklandDate = new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND });
const aucklandDay = new Intl.DateTimeFormat('en-NZ', {
  timeZone: AUCKLAND,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });

/** "2026-12-12": the Auckland calendar date of an instant. */
export const aucklandDateOf = (instant: Date): string => aucklandDate.format(instant);

/** "2026-12-12" plus `days`. */
export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const plainDay = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Sat 19 Dec" for a "2026-12-19" date, which is already an Auckland date: no zone shift. */
export const formatIsoDay = (isoDate: string): string =>
  plainDay.format(new Date(`${isoDate}T00:00:00Z`)).replace(',', '');

/** "Sat 12 Dec". */
export const formatAucklandDay = (instant: Date): string =>
  aucklandDay.format(instant).replace(',', '');

export const formatNzd = (amount: number): string => money.format(amount);

/** Still on the booking: a request waiting for review or an approved stay; not refused or cancelled. */
export const isOnBooking = (record: ManagerBookingRecord): boolean =>
  record.booking.manager_review_status === 'pending' ||
  record.booking.manager_review_status === 'approved';

/** A stay a manager approved: the only kind that is held, checked in and charged. */
export const isApprovedStay = (record: ManagerBookingRecord): boolean =>
  record.booking.manager_review_status === 'approved';

/**
 * Made with a saved card, and the money is not settled yet. A pay-at-request stay already charged
 * on confirmation ('succeeded', nothing settled) is still open: the desk refunds what is not owed.
 */
export const isOpenCardBooking = (record: ManagerBookingRecord): boolean => {
  const card = record.booking.card_guarantee;
  return (
    card !== null &&
    card.captured_amount === null &&
    (card.status === 'pending' ||
      card.status === 'authorized' ||
      card.status === 'failed' ||
      card.status === 'succeeded')
  );
};

/** From the drop-off day in Auckland, staff record how an approved stay's arrival went. */
export const arrivalCanBeRecorded = (record: ManagerBookingRecord, now: Date): boolean => {
  const { drop_off_at: dropOffAt } = record.booking;
  return (
    isApprovedStay(record) &&
    isOpenCardBooking(record) &&
    dropOffAt !== null &&
    aucklandDateOf(now) >= aucklandDateOf(new Date(dropOffAt))
  );
};

/** An arrival from before today that nobody recorded. */
export const isUnrecordedArrival = (record: ManagerBookingRecord, now: Date): boolean =>
  arrivalCanBeRecorded(record, now) &&
  record.booking.check_in_outcome === null &&
  record.booking.drop_off_at !== null &&
  aucklandDateOf(now) > aucklandDateOf(new Date(record.booking.drop_off_at));

const toCents = (amount: number): number => Math.round(amount * 100);

/** Share of the stay a no-show costs under the pay-at-request terms (Backend BOOKING_POLICY). */
const SHORT_NOTICE_FEE_PERCENT = 50;

/**
 * A no-show costs half the pet's stay under the pay-at-request terms, and its first night under the
 * older ones: one night of its per-night lines, never more than its price (Backend
 * booking.fee-policy.ts `shortNoticeFee`, `lateFee`). A pet without vaccination proof is checked
 * in and kept apart, at no fee.
 */
const noShowFeeCents = (record: ManagerBookingRecord): number => {
  const price = toCents(record.booking.pet_price);
  if (record.booking.card_guarantee?.pays_at_request) {
    return Math.round((Math.max(0, price) * SHORT_NOTICE_FEE_PERCENT) / 100);
  }
  return Math.max(0, Math.min(price, toCents(record.booking.pet_nightly_rate)));
};

/**
 * What finishing check-in charges for a booking's approved pets, never more than the card holds;
 * null until every approved pet has an outcome.
 */
export const amountDueAtDesk = (petsOfBooking: ManagerBookingRecord[]): number | null => {
  const pets = petsOfBooking.filter(isApprovedStay);
  if (pets.length === 0 || pets.some((pet) => pet.booking.check_in_outcome === null)) return null;
  const due = pets.reduce((cents, pet) => {
    const price = toCents(pet.booking.pet_price);
    if (pet.booking.check_in_outcome === 'checked_in') return cents + price;
    if (pet.booking.check_in_outcome === 'no_show') return cents + noShowFeeCents(pet);
    return cents;
  }, 0);
  const held = toCents(pets[0]?.booking.card_guarantee?.amount ?? 0);
  return Math.min(due, held) / 100;
};
