import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import {
  PAY_AT_REQUEST_TERMS_VERSION,
  SIMPLE_CHANGES_TERMS_VERSION,
} from '../contracts/booking.terms.contract.js';

export type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';

/**
 * Owner-approved policy (2026-10-01, simplified 2026-10-05). The price is held on the card when the
 * request is sent and charged once the stay is confirmed, so only paid stays keep a room. Cancelling
 * a confirmed stay costs more the closer it is to drop-off, each tier a genuine estimate of the loss
 * (Commerce Commission v Bachcare [2025] NZHC 3661 [109]): free 7 days or more ahead, one night per
 * pet from 72 hours to 7 days (never more than half its stay), half the stay inside 72 hours or for
 * a no-show. A request waits at most 24 hours for our manager. Money uses integer cents.
 */

export const BOOKING_POLICY = {
  freeCancellationHours: 168,
  shortNoticeHours: 72,
  shortNoticeFeePercent: 50,
  reviewWindowHours: 24,
  reviewReminderHours: 4,
  /** Older bookings were held this long before drop-off; the reminder email still goes then. */
  holdHoursBeforeDropOff: 48,
  lateFeeBasis: 'first_night',
  rescheduleWindowDays: 365,
} as const;

/**
 * Rules that only bookings agreed under terms before concierge-terms-2026-10-06 still have: free
 * cancelling for a while after confirmation, and one free change of dates.
 */
export const OLDER_TERMS_POLICY = {
  coolingOffHours: 24,
  approvalGraceHours: 2,
  freeReschedules: 1,
} as const;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

const toCents = (amount: number): number => Math.round(amount * 100);
const fromCents = (cents: number): number => cents / 100;

/** One night of recurring services, capped at this pet's total; flat extras are excluded. */
export const lateFee = (amount: number, nightlyRate: number): number =>
  fromCents(Math.max(0, Math.min(toCents(amount), toCents(nightlyRate))));

/** Half of this pet's stay, for cancelling inside 72 hours or not arriving. */
export const shortNoticeFee = (amount: number): number =>
  fromCents(
    Math.round((Math.max(0, toCents(amount)) * BOOKING_POLICY.shortNoticeFeePercent) / 100),
  );

const hoursBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / MS_PER_HOUR;

export interface BookingTimes {
  bookedAt: Date;
  dropOffAt: Date;
}

/**
 * When our manager must have decided a request: 24 hours after it was sent, or the drop-off time
 * if that comes first. After it the hold is released and the room freed.
 */
export const reviewDeadlineFor = ({ bookedAt, dropOffAt }: BookingTimes): Date => {
  const windowEnd = bookedAt.getTime() + BOOKING_POLICY.reviewWindowHours * MS_PER_HOUR;
  return new Date(Math.min(windowEnd, dropOffAt.getTime()));
};

/** Older bookings only: when the price was held, 48 hours before drop-off or at once if later. */
export const holdTimeFor = ({ bookedAt, dropOffAt }: BookingTimes): Date => {
  const hold = new Date(dropOffAt.getTime() - BOOKING_POLICY.holdHoursBeforeDropOff * MS_PER_HOUR);
  return hold.getTime() > bookedAt.getTime() ? hold : bookedAt;
};

/**
 * Which fee rules a booking agreed to; a booking keeps the rules of its terms version.
 * - `tiered` (2026-10-06 on): free 7 days or more ahead, one night per pet from 72 hours to 7 days
 *   (never more than half its stay), half inside 72 hours or for a no-show.
 * - `tiered_with_grace` (2026-10-02): the same tiers without the half-stay cap, plus free cancelling
 *   within 2 hours of confirmation and a 24-hour cooling-off.
 * - `first_night` (earlier): free 72 hours or more ahead, then one night per pet, also for a
 *   no-show, with the same grace and cooling-off.
 */
export type FeeSchedule = 'tiered' | 'tiered_with_grace' | 'first_night';

/** The fee rules of a terms version label such as "concierge-terms-2026-10-06" ('' when none). */
export const feeScheduleFor = (termsVersion: string): FeeSchedule => {
  if (termsVersion >= SIMPLE_CHANGES_TERMS_VERSION) return 'tiered';
  if (termsVersion >= PAY_AT_REQUEST_TERMS_VERSION) return 'tiered_with_grace';
  return 'first_night';
};

/** How many date changes a guest may make; null means as many as they need before drop-off. */
export const dateChangeLimitFor = (termsVersion: string): number | null =>
  termsVersion >= SIMPLE_CHANGES_TERMS_VERSION ? null : OLDER_TERMS_POLICY.freeReschedules;

export type CancellationRule =
  | 'early'
  | 'cooling_off'
  | 'approval_grace'
  | 'approval_time_unknown'
  | 'exception'
  | 'late'
  | 'short_notice';

export type CancellationDecision =
  | { allowed: true; rule: CancellationRule; fee: number }
  | { allowed: false; reason: 'after_drop_off' };

export interface CancellationInput extends BookingTimes {
  total: number;
  nightlyRate: number;
  approvedAt: Date | null;
  now: Date;
  /** Staff waive the fee for an emergency, a red warning or a vet-certified sick pet. */
  exception?: boolean;
  /** The rules the booking agreed to; the current terms when left out. */
  schedule?: FeeSchedule;
}

/**
 * The free windows the older terms gave after confirmation, or null when none applies. Approved
 * before approval times were recorded: the windows cannot be worked out, so no fee is charged
 * rather than guessing the approval time.
 */
const olderTermsFreeRule = (input: CancellationInput): CancellationRule | null => {
  if (!input.approvedAt) return 'approval_time_unknown';
  if (hoursBetween(input.approvedAt, input.now) <= OLDER_TERMS_POLICY.approvalGraceHours) {
    return 'approval_grace';
  }
  const bookedWellAhead =
    hoursBetween(input.approvedAt, input.dropOffAt) >= BOOKING_POLICY.shortNoticeHours;
  const withinCoolingOff =
    hoursBetween(input.approvedAt, input.now) <= OLDER_TERMS_POLICY.coolingOffHours;
  return bookedWellAhead && withinCoolingOff ? 'cooling_off' : null;
};

/**
 * One night of recurring services. The current terms never charge more for cancelling early than
 * for cancelling inside 72 hours, so for a short stay it stops at half the stay.
 */
const firstNightFee = (input: CancellationInput, schedule: FeeSchedule): number => {
  const firstNight = lateFee(input.total, input.nightlyRate);
  return schedule === 'tiered' ? Math.min(firstNight, shortNoticeFee(input.total)) : firstNight;
};

/**
 * What cancelling costs right now. Once the drop-off time has passed the guest can no longer
 * cancel online: the stay is then a check-in or a no-show, which staff record at the desk.
 */
export const decideCancellation = (input: CancellationInput): CancellationDecision => {
  if (input.now.getTime() >= input.dropOffAt.getTime()) {
    return { allowed: false, reason: 'after_drop_off' };
  }
  if (input.exception) return { allowed: true, rule: 'exception', fee: 0 };
  const schedule = input.schedule ?? 'tiered';
  const hoursLeft = hoursBetween(input.now, input.dropOffAt);
  const freeFromHours =
    schedule === 'first_night'
      ? BOOKING_POLICY.shortNoticeHours
      : BOOKING_POLICY.freeCancellationHours;
  if (hoursLeft >= freeFromHours) return { allowed: true, rule: 'early', fee: 0 };
  if (schedule !== 'tiered') {
    const freeRule = olderTermsFreeRule(input);
    if (freeRule) return { allowed: true, rule: freeRule, fee: 0 };
  }
  if (schedule === 'first_night' || hoursLeft >= BOOKING_POLICY.shortNoticeHours) {
    return { allowed: true, rule: 'late', fee: firstNightFee(input, schedule) };
  }
  return { allowed: true, rule: 'short_notice', fee: shortNoticeFee(input.total) };
};

export interface PetAtDesk {
  /** What this pet's stay costs: the sum of its quoted lines. */
  price: number;
  nightlyRate: number;
  outcome: CheckInOutcome;
}

/**
 * What the stay costs once every pet on the booking has an outcome. A no-show is half its stay
 * under the pay-at-request terms, and its first night under the older ones.
 */
export const captureAmountFor = (pets: PetAtDesk[], schedule: FeeSchedule = 'tiered'): number =>
  fromCents(
    pets.reduce((cents, pet) => {
      if (pet.outcome === 'checked_in') return cents + toCents(pet.price);
      if (pet.outcome === 'no_show') {
        const fee =
          schedule === 'first_night'
            ? lateFee(pet.price, pet.nightlyRate)
            : shortNoticeFee(pet.price);
        return cents + toCents(fee);
      }
      return cents;
    }, 0),
  );

export type RescheduleRefusal = 'after_drop_off' | 'no_free_reschedule_left' | 'too_far_ahead';

export type RescheduleDecision =
  { allowed: true; usesFreeReschedule: boolean } | { allowed: false; reason: RescheduleRefusal };

export interface RescheduleInput {
  dropOffAt: Date;
  now: Date;
  rescheduleCount: number;
  /** From the booking's terms (dateChangeLimitFor); null when dates can change as often as needed. */
  dateChangeLimit: number | null;
  /** The new drop-off date, YYYY-MM-DD in New Zealand. */
  newStartDate: string;
  /** Today in New Zealand, YYYY-MM-DD. */
  today: string;
  /** Staff grant it for an emergency or a sick pet; it does not use the free reschedule. */
  exception?: boolean;
}

const daysBetweenDates = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

/**
 * Whether the stay can move to a new start date. The new dates still go through the normal quote
 * and capacity checks; this only applies the reschedule rules. `usesFreeReschedule` is true only
 * under older terms, where the guest had one free change.
 */
export const decideReschedule = (input: RescheduleInput): RescheduleDecision => {
  if (input.now.getTime() >= input.dropOffAt.getTime()) {
    return { allowed: false, reason: 'after_drop_off' };
  }
  if (daysBetweenDates(input.today, input.newStartDate) > BOOKING_POLICY.rescheduleWindowDays) {
    return { allowed: false, reason: 'too_far_ahead' };
  }
  if (input.exception || input.dateChangeLimit === null) {
    return { allowed: true, usesFreeReschedule: false };
  }
  if (input.rescheduleCount >= input.dateChangeLimit) {
    return { allowed: false, reason: 'no_free_reschedule_left' };
  }
  return { allowed: true, usesFreeReschedule: true };
};
