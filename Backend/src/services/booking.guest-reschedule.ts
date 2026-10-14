import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  formatNewZealandTime,
  newZealandDateOf,
  newZealandWallClockToDate,
} from '../common/utils/new-zealand-time.js';
import {
  RESCHEDULE_PRICE_CHANGED,
  type NewDates,
  type ReschedulePreview,
  type RescheduleResult,
  type RescheduleStayInput,
} from '../contracts/booking.change.contract.js';
import { CONCIERGE_MAX_STAY_NIGHTS } from '../contracts/concierge.contract.js';
import { lockBookingCapacity } from '../repositories/booking.capacity.repository.js';
import {
  moveStay,
  renewGuarantee,
  type MovedPet,
} from '../repositories/booking.change.repository.js';
import {
  withLockedBooking,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { findFullNights, fullyBookedError } from './booking.capacity.js';
import {
  dateChangeLimitFor,
  decideReschedule,
  holdTimeFor,
  type RescheduleRefusal,
} from './booking.fee-policy.js';
import {
  assertPreviewedAmount,
  changeableStay,
  stayStarted,
  type ChangeableStay,
  type ChangeDependencies,
} from './booking.guest-change.js';
import { bookingNotFound, processorFor, withProcessor } from './booking.guarantee.js';
import { chargeWhenDecided, isChargedUnsettled } from './booking.settlement.js';
import { toConfirmationNumber } from './petparent.booking.js';
import { nightsBetween, roundToCents } from './booking.pricing.js';
import type { CardProcessor } from './payments/card-processor.js';
import { notifyBookingDatesChanged } from './booking.notifications.js';
import { createTasksForBookingPet, deleteTasksForBookingPet } from './task.fromBooking.service.js';

/**
 * Moving a stay made with a saved card to new dates (booking.fee-policy.ts has the rules): by the
 * guest before the drop-off time, to dates within 12 months, at the rates booked, as often as they
 * need under the current terms and once under older ones; or by staff for an emergency, a red
 * warning or a sick pet, which never counts as the guest's change. The new nights must have room.
 *
 * Older bookings: the old hold is released and the 48-hour job holds the approved pets' price for
 * the new dates. A guest's own change sends every moved pet back to manager review (the manager
 * agreed to the old dates only) and tells the managers and the parent.
 *
 * Paid at request (newer terms): the new price is held first, so a declined card changes nothing.
 * The decisions stand (what a manager checks, medication, health, a first stay, does not depend on
 * the dates), the confirmed pets are charged at the new price, and the old payment is released or
 * refunded in full. Staff moving a stay for an emergency always keep their decisions, and the
 * approved pets get a care plan for the new dates.
 */

const rescheduleRefused = (reason: RescheduleRefusal): AppError => {
  switch (reason) {
    case 'after_drop_off':
      return stayStarted();
    case 'no_free_reschedule_left':
      return new AppError(
        "You've already changed the dates of this stay once. Please contact our team to change them again.",
        'RESCHEDULE_USED',
        409,
      );
    case 'too_far_ahead':
      return new AppError(
        'Choose a check-in date within the next 12 months.',
        'RESCHEDULE_TOO_FAR',
        409,
      );
  }
};

const invalidDates = (): AppError =>
  new AppError(
    `Choose a check-in from today, a check-out after it, and at most ${CONCIERGE_MAX_STAY_NIGHTS} nights.`,
    'RESCHEDULE_DATES_INVALID',
    422,
  );

interface ReschedulePlan {
  moved: MovedPet[];
  nights: number;
  total: number;
  usesFreeReschedule: boolean;
  /** The guest's own change, counted on the booking; a staff exception is not. */
  countsAsDateChange: boolean;
  newDropOffAt: Date;
  holdAt: Date;
  paysNow: boolean;
  /** Each moved pet's price at the new dates, for charging the confirmed ones. */
  pets: PetAtTheDesk[];
}

interface PlanOptions {
  now: Date;
  exception: boolean;
  /** The booking transaction: capacity is then counted under the booking lock. */
  client?: PoolClient;
}

const planReschedule = async (
  booking: LockedBooking,
  stay: ChangeableStay,
  dates: NewDates,
  options: PlanOptions,
): Promise<ReschedulePlan> => {
  const today = newZealandDateOf(options.now);
  const decision = decideReschedule({
    dropOffAt: stay.dropOffAt,
    now: options.now,
    rescheduleCount: booking.rescheduleCount,
    dateChangeLimit: dateChangeLimitFor(booking.termsVersion),
    newStartDate: dates.startDate,
    today,
    exception: options.exception,
  });
  if (!decision.allowed) throw rescheduleRefused(decision.reason);
  const nights = nightsBetween(dates.startDate, dates.endDate);
  if (
    dates.startDate < today ||
    dates.endDate <= dates.startDate ||
    nights > CONCIERGE_MAX_STAY_NIGHTS
  ) {
    throw invalidDates();
  }
  // Each pet keeps its own drop-off and pick-up time of day.
  const moved = stay.pets.map((pet) => ({
    bookingPetsUuid: pet.bookingPetsUuid,
    dropOffAt: newZealandWallClockToDate(dates.startDate, formatNewZealandTime(pet.dropOffAt)),
    pickUpAt: newZealandWallClockToDate(dates.endDate, formatNewZealandTime(pet.pickUpAt)),
  }));
  const newDropOffAt = new Date(Math.min(...moved.map((pet) => pet.dropOffAt.getTime())));
  if (newDropOffAt.getTime() <= options.now.getTime()) throw invalidDates();

  if (options.client) await lockBookingCapacity(options.client);
  const fullNights = await findFullNights(
    {
      startDate: dates.startDate,
      endDate: dates.endDate,
      petCount: stay.pets.length,
      excludeBookingId: booking.bookingId,
    },
    options.client,
  );
  if (fullNights.length > 0) throw fullyBookedError(fullNights);

  return {
    moved,
    nights,
    total: roundToCents(
      stay.pets.reduce((sum, pet) => sum + pet.nightlyRate * nights + pet.flatPrice, 0),
    ),
    usesFreeReschedule: decision.usesFreeReschedule,
    countsAsDateChange: !options.exception,
    newDropOffAt,
    holdAt: holdTimeFor({ bookedAt: options.now, dropOffAt: newDropOffAt }),
    paysNow: booking.paysAtRequest,
    pets: booking.pets.map((pet) => {
      const movedPet = moved.find((candidate) => candidate.bookingPetsUuid === pet.bookingPetsUuid);
      return movedPet
        ? {
            ...pet,
            price: roundToCents(pet.nightlyRate * nights + pet.flatPrice),
            dropOffAt: movedPet.dropOffAt,
            pickUpAt: movedPet.pickUpAt,
          }
        : pet;
    }),
  };
};

const previewOf = (dates: NewDates, plan: ReschedulePlan): ReschedulePreview => ({
  startDate: dates.startDate,
  endDate: dates.endDate,
  nights: plan.nights,
  total: plan.total,
  usesFreeReschedule: plan.usesFreeReschedule,
  holdAt: plan.holdAt.toISOString(),
  paysNow: plan.paysNow,
});

const declinedForNewDates = (): AppError =>
  new AppError(
    'Your card was declined for the new price, so your dates did not change. Please contact our team.',
    'CARD_DECLINED',
    402,
  );

/**
 * Paid at request: holds the new price, moves the stay keeping its decisions, charges the
 * confirmed pets if nobody waits, then gives back the old payment. The old payment goes last, so
 * a failure before that leaves it untouched; every call is keyed to the old payment, so a retry
 * after a failure replays the same hold, capture and refund rather than adding new ones.
 */
const applyPaidReschedule = async (
  booking: LockedBooking,
  stay: ChangeableStay,
  plan: ReschedulePlan,
  cards: CardProcessor,
  client: PoolClient,
): Promise<void> => {
  const old = stay.payment;
  const hold = await withProcessor(() =>
    cards.placeHold({
      paymentMethodId: old.paymentMethodId,
      amount: plan.total,
      reference: toConfirmationNumber(booking.bookingId),
      idempotencyKey: `reschedule-hold-${booking.bookingId}-${old.paymentIntentId ?? 'none'}`,
    }),
  );
  if (hold.status !== 'succeeded') throw declinedForNewDates();
  await moveStay(client, booking.bookingId, plan.moved, plan.countsAsDateChange, false);
  await renewGuarantee(client, old.paymentId, {
    status: 'authorized',
    amount: plan.total,
    paymentIntentId: hold.paymentIntentId,
  });
  const renewed: LockedBooking = {
    ...booking,
    payment: {
      ...old,
      status: 'authorized',
      amount: plan.total,
      capturedAmount: null,
      paymentIntentId: hold.paymentIntentId,
    },
  };
  await chargeWhenDecided(renewed, plan.pets, client, cards);
  const oldIntent = old.paymentIntentId;
  if (!oldIntent) return;
  if (isChargedUnsettled(old)) {
    await withProcessor(() =>
      cards.refund(oldIntent, old.amount, `refund-reschedule-${oldIntent}`),
    );
  } else if (old.status === 'authorized') {
    await withProcessor(() => cards.releaseHold(oldIntent));
  }
};

/** A guest cannot move a stay whose card was already refused: the team sorts that out. */
const guestChangeableStay = (booking: LockedBooking, ownerId: string): ChangeableStay => {
  const stay = changeableStay(booking, ownerId);
  if (stay.payment.status === 'failed') {
    throw new AppError(
      "We couldn't hold your card for this stay, so its dates can't be changed online. Please contact our team.",
      'BOOKING_CARD_FAILED',
      409,
    );
  }
  return stay;
};

/** The old hold no longer matches the dates: release it, and let the job hold the new ones. */
const applyReschedule = async (
  bookingId: string,
  stay: ChangeableStay,
  plan: ReschedulePlan,
  cardsFor: () => CardProcessor,
  client: PoolClient,
  returnToReview: boolean,
): Promise<void> => {
  await moveStay(client, bookingId, plan.moved, plan.countsAsDateChange, returnToReview);
  await renewGuarantee(client, stay.payment.paymentId, {
    status: 'pending',
    amount: plan.total,
    // Retain the released intent for a fresh hold idempotency key after reapproval.
    paymentIntentId: stay.payment.paymentIntentId,
  });
  const oldHold = stay.payment.paymentIntentId;
  if (stay.payment.status === 'authorized' && oldHold) {
    await withProcessor(() => cardsFor().releaseHold(oldHold));
  }
};

export const previewReschedule = async (
  ownerId: string,
  bookingId: string,
  dates: NewDates,
  dependencies: ChangeDependencies = {},
): Promise<ReschedulePreview> => {
  const now = dependencies.now ?? new Date();
  const preview = await withLockedBooking(bookingId, async (booking) => {
    const stay = guestChangeableStay(booking, ownerId);
    return previewOf(dates, await planReschedule(booking, stay, dates, { now, exception: false }));
  });
  if (!preview) throw bookingNotFound();
  return preview;
};

interface MoveOptions {
  /** The guest's own stay; null when staff move it. */
  ownerId: string | null;
  dependencies: ChangeDependencies;
}

const moveBooking = async (
  bookingId: string,
  input: RescheduleStayInput,
  { ownerId, dependencies }: MoveOptions,
): Promise<RescheduleResult> => {
  const now = dependencies.now ?? new Date();
  const exception = ownerId === null;
  const dates: NewDates = { startDate: input.startDate, endDate: input.endDate };
  const moved = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = exception ? changeableStay(booking, null) : guestChangeableStay(booking, ownerId);
    const plan = await planReschedule(booking, stay, dates, { now, exception, client });
    assertPreviewedAmount(
      input.expectedTotal,
      plan.total,
      RESCHEDULE_PRICE_CHANGED,
      'The price for these dates has changed since you checked it. Please look at the new total and confirm again.',
    );
    const cardsFor = (): CardProcessor => processorFor(stay.payment, dependencies.cardProcessor);
    // Care plans are found by the stay's dates, so the old plan goes before the new dates are
    // written, in the same transaction: a failed move keeps both the dates and the plan.
    for (const pet of stay.pets) await deleteTasksForBookingPet(pet.bookingPetsUuid, client);
    if (plan.paysNow) {
      await applyPaidReschedule(booking, stay, plan, cardsFor(), client);
    } else {
      await applyReschedule(bookingId, stay, plan, cardsFor, client, !exception);
    }
    // A paid stay keeps its decisions; an older one keeps them only when staff move it.
    const keepsDecisions = plan.paysNow || exception;
    return {
      result: { ...previewOf(dates, plan), held: plan.paysNow },
      pets: stay.pets.map((pet) => ({
        id: pet.bookingPetsUuid,
        keepsApproval: keepsDecisions && pet.reviewStatus === 'approved',
      })),
      backToReview: !keepsDecisions,
    };
  });
  if (!moved) throw bookingNotFound();
  // Only a stay that is still approved gets a care plan for its new dates.
  for (const pet of moved.pets) {
    if (pet.keepsApproval) await createTasksForBookingPet(pet.id);
  }
  if (moved.backToReview) await notifyBookingDatesChanged(bookingId);
  return moved.result;
};

export const rescheduleByGuest = (
  ownerId: string,
  bookingId: string,
  input: RescheduleStayInput,
  dependencies: ChangeDependencies = {},
): Promise<RescheduleResult> => moveBooking(bookingId, input, { ownerId, dependencies });

/** Staff move a stay for an emergency, a red warning or a sick pet: no fee, no free change used. */
export const rescheduleAsException = (
  bookingId: string,
  dates: NewDates,
  dependencies: ChangeDependencies = {},
): Promise<RescheduleResult> => moveBooking(bookingId, dates, { ownerId: null, dependencies });
