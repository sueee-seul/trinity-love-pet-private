import {
  formatNewZealandDay,
  formatNewZealandTime,
  newZealandDateOf,
  newZealandHourOf,
} from '../common/utils/new-zealand-time.js';
import {
  BOOKING_ARRIVAL_UNMARKED,
  BOOKING_CARD_HOLD_FAILED,
} from '../contracts/booking.notification.contract.js';
import type {
  DueBooking,
  GuaranteePaymentStatus,
  HoldResult,
  ManagerFlag,
  UnmarkedArrival,
} from '../repositories/booking.hold-reminder.repository.js';
import { BOOKING_POLICY, decideCancellation, feeScheduleFor } from './booking.fee-policy.js';
import {
  cardHoldFailedEmail,
  dropOffReminderEmail,
  type BookingEmailDetails,
  type TeamContact,
} from './booking.reminder-emails.js';
import type { ConciergeEmailSender } from './concierge/concierge.email.js';
import { toCents, type CardProcessor } from './payments/card-processor.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * The booking job that runs every 15 minutes (see booking.jobs.ts):
 *
 * 1. 48 hours before drop-off it holds the full price on the saved card (off session: the guest is
 *    not there) and emails the reminder: what to bring to the desk, and that the card is held.
 *    A booking made later than that was held at checkout and only gets the reminder.
 * 2. A refused hold does not cancel the booking. The guest is emailed to give another card, and
 *    every manager gets a flag. The card is not tried again: repeated attempts on a declined card
 *    look like card testing to banks.
 * 3. From 8am, it flags each arrival from the past week that nobody recorded at the desk. Nothing
 *    is charged for a no-show until staff record it.
 *
 * Every step can run twice without effect: the hold uses one idempotency key per booking, and each
 * write only applies to the state it expects. A processor that cannot be reached, or an email that
 * fails, leaves the booking for the next run.
 */

export interface HoldReminderStore {
  findDueBookings(now: Date, holdHoursBeforeDropOff: number): Promise<DueBooking[]>;
  recordHold(bookingId: string, result: HoldResult, flag: ManagerFlag | null): Promise<boolean>;
  markReminderSent(bookingId: string, at: Date): Promise<void>;
  findUnmarkedArrivals(today: string): Promise<UnmarkedArrival[]>;
  flagManagers(flag: ManagerFlag): Promise<void>;
}

export interface BookingJobContext {
  store: HoldReminderStore;
  /** This server's processor; bookings saved with another one are left alone. */
  cardProcessor: CardProcessor | null;
  /** Null when email is not set up: cards are still held, and reminders wait. */
  emailSender: ConciergeEmailSender | null;
  contact: TeamContact;
  now: Date;
  log: (message: string) => void;
}

export interface HoldReminderSummary {
  held: number;
  refused: number;
  reminded: number;
  /** Left for the next run: the processor could not be reached, or an email or write failed. */
  retryLater: number;
  /** Saved with a processor this server does not run, or changed while the job ran. */
  skipped: number;
}

/** Arrivals are flagged the next morning, not at midnight. */
export const UNMARKED_ARRIVAL_FLAG_HOUR = 8;

/**
 * One hold per booking and drop-off: moving the stay to new dates releases the old hold, and the
 * processor would otherwise replay that released hold for the same key within a day.
 */
/**
 * One key per hold, so a retried step never holds twice. A hold placed after an earlier one was
 * released (the approved pets changed) carries the released hold's id, so it is a new hold.
 */
export const holdKeyFor = (
  bookingId: string,
  dropOffAt: Date,
  releasedHoldId: string | null = null,
): string =>
  `hold-booking-${bookingId}-${dropOffAt.getTime()}${releasedHoldId ? `-after-${releasedHoldId}` : ''}`;

const at = (instant: Date): string =>
  `${formatNewZealandDay(instant)}, ${formatNewZealandTime(instant)}`;

const holdFailedFlag = (booking: DueBooking): ManagerFlag => ({
  bookingId: booking.bookingId,
  setting: BOOKING_CARD_HOLD_FAILED,
  summary: `Card hold failed for ${toConfirmationNumber(booking.bookingId)} (drop-off ${at(booking.dropOffAt)}). The guest was asked for another card.`,
});

const unmarkedArrivalFlag = (arrival: UnmarkedArrival): ManagerFlag => ({
  bookingId: arrival.bookingId,
  setting: BOOKING_ARRIVAL_UNMARKED,
  summary: `Arrival not recorded for ${toConfirmationNumber(arrival.bookingId)} (drop-off ${formatNewZealandDay(arrival.dropOffAt)}). Record each pet as checked in, no-show or Wagstay unable.`,
});

/**
 * Holds the price on the card. Returns the payment status afterwards, or null when the booking
 * changed while the card was being held (e.g. the guest cancelled): that hold is released at once.
 */
const holdCard = async (
  booking: DueBooking,
  processor: CardProcessor,
  context: BookingJobContext,
): Promise<GuaranteePaymentStatus | null> => {
  const charge = await processor.placeHold({
    paymentMethodId: booking.paymentMethodId,
    amount: booking.amount,
    reference: toConfirmationNumber(booking.bookingId),
    idempotencyKey: holdKeyFor(booking.bookingId, booking.dropOffAt, booking.releasedHoldId),
  });
  const result: HoldResult = {
    status: charge.status === 'succeeded' ? 'authorized' : 'failed',
    paymentIntentId: charge.paymentIntentId,
    amount: booking.amount,
  };
  const flag = result.status === 'failed' ? holdFailedFlag(booking) : null;
  const recorded = await context.store.recordHold(booking.bookingId, result, flag);
  if (recorded) return result.status;
  if (result.status === 'authorized' && result.paymentIntentId) {
    await processor.releaseHold(result.paymentIntentId);
  }
  return null;
};

const emailDetails = (
  booking: DueBooking,
  context: BookingJobContext,
  testMode: boolean,
): BookingEmailDetails => ({
  to: booking.ownerEmail,
  firstName: booking.ownerFirstName,
  reference: toConfirmationNumber(booking.bookingId),
  dropOffAt: booking.dropOffAt,
  pickUpAt: booking.pickUpAt,
  petNames: booking.petNames,
  amount: booking.amount,
  testMode,
  contact: context.contact,
});

/**
 * What cancelling costs as the reminder goes out, by the same per-pet rule as My Stays, capped at
 * the hold. Null once a pet's stay has started (it can no longer be cancelled online).
 */
const cancellationFeeNow = (booking: DueBooking, now: Date): number | null => {
  let cents = 0;
  for (const pet of booking.approvedPets) {
    const decision = decideCancellation({
      bookedAt: booking.bookedAt,
      approvedAt: pet.approvedAt,
      dropOffAt: pet.dropOffAt,
      total: pet.price,
      nightlyRate: pet.nightlyRate,
      now,
      schedule: feeScheduleFor(booking.termsVersion),
    });
    if (!decision.allowed) return null;
    cents += toCents(decision.fee);
  }
  return Math.min(cents, toCents(booking.amount)) / 100;
};

const processDueBooking = async (
  booking: DueBooking,
  context: BookingJobContext,
  summary: HoldReminderSummary,
): Promise<void> => {
  const processor = context.cardProcessor;
  // Only the processor the card was saved with can hold it, and only it knows if this is a test.
  if (!processor || processor.name !== booking.processor) {
    summary.skipped += 1;
    return;
  }
  let status = booking.paymentStatus;
  if (status === 'pending') {
    const afterHold = await holdCard(booking, processor, context);
    if (!afterHold) {
      summary.skipped += 1;
      return;
    }
    status = afterHold;
    if (status === 'authorized') summary.held += 1;
    else summary.refused += 1;
  }
  if (!context.emailSender) return;

  const details = emailDetails(booking, context, processor.testMode);
  await context.emailSender.sendBookingEmail(
    status === 'failed'
      ? cardHoldFailedEmail(details)
      : dropOffReminderEmail({
          ...details,
          cancellationFee: cancellationFeeNow(booking, context.now),
          paid: status === 'succeeded',
          schedule: feeScheduleFor(booking.termsVersion),
        }),
  );
  await context.store.markReminderSent(booking.bookingId, context.now);
  summary.reminded += 1;
};

export const runHoldAndReminderPass = async (
  context: BookingJobContext,
): Promise<HoldReminderSummary> => {
  const summary: HoldReminderSummary = {
    held: 0,
    refused: 0,
    reminded: 0,
    retryLater: 0,
    skipped: 0,
  };
  const due = await context.store.findDueBookings(
    context.now,
    BOOKING_POLICY.holdHoursBeforeDropOff,
  );
  for (const booking of due) {
    try {
      await processDueBooking(booking, context, summary);
    } catch (error: unknown) {
      // One booking's trouble never stops the others; it is tried again on the next run.
      summary.retryLater += 1;
      context.log(
        `Booking job: ${toConfirmationNumber(booking.bookingId)} left for the next run (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
  }
  return summary;
};

/** Flags each unrecorded arrival once, from the morning after drop-off. Returns how many. */
export const flagUnmarkedArrivals = async (context: BookingJobContext): Promise<number> => {
  if (newZealandHourOf(context.now) < UNMARKED_ARRIVAL_FLAG_HOUR) return 0;
  const arrivals = await context.store.findUnmarkedArrivals(newZealandDateOf(context.now));
  for (const arrival of arrivals) {
    await context.store.flagManagers(unmarkedArrivalFlag(arrival));
  }
  return arrivals.length;
};

/** One run of the whole job. */
export const runBookingJobs = async (context: BookingJobContext): Promise<void> => {
  const summary = await runHoldAndReminderPass(context);
  const flagged = await flagUnmarkedArrivals(context);
  const worked = Object.values(summary).some((count) => count > 0) || flagged > 0;
  if (worked) {
    context.log(
      `Booking job: ${summary.held} held, ${summary.refused} refused, ${summary.reminded} reminded, ${summary.retryLater} for later, ${summary.skipped} skipped, ${flagged} arrivals flagged`,
    );
  }
};
