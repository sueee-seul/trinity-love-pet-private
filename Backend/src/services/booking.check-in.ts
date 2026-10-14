import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandDateOf } from '../common/utils/new-zealand-time.js';
import type {
  CheckInOutcome,
  FinishCheckInResponse,
} from '../contracts/booking.check-in.contract.js';
import {
  cancelActivePets,
  findArrivalTarget,
  isActivePet,
  isConfirmedPet,
  saveArrival,
  settlePayment,
  withLockedBooking,
  type GuaranteePayment,
} from '../repositories/booking.check-in.repository.js';
import {
  captureAmountFor,
  feeScheduleFor,
  type FeeSchedule,
  type PetAtDesk,
} from './booking.fee-policy.js';
import {
  alreadySettled,
  bookingNotFound,
  capToLiveHold,
  openGuaranteeOf,
  processorFor,
  releaseGuarantee,
  withProcessor,
  type GuaranteeDependencies,
} from './booking.guarantee.js';
import { isChargedUnsettled, settleCharged } from './booking.settlement.js';
import type { CardProcessor } from './payments/card-processor.js';
import { toConfirmationNumber } from './petparent.booking.js';
import { createTasksForBookingPet, deleteTasksForBookingPet } from './task.fromBooking.service.js';

/**
 * The desk, for bookings guaranteed by a saved card.
 *
 * Staff record how each pet's arrival went (from the drop-off day), then finish check-in once for
 * the booking. That takes what the outcomes cost (booking.fee-policy.ts) from the hold in one
 * capture, and the processor releases the rest; when nothing is due the whole hold is released.
 * Nothing is ever charged without a recorded outcome: a no-show costs money only once staff say so.
 *
 * Wagstay can also cancel: refusing the last pet (Wagstay cannot take it) or cancelling for an
 * emergency, a red warning or a vet-certified sick pet releases the hold in full.
 *
 * Money only moves inside a transaction that holds the payment row, so two managers cannot charge
 * the same booking twice, and every charge carries an idempotency key.
 */

export type DeskDependencies = GuaranteeDependencies;

const notFound = bookingNotFound;

export const recordArrival = async (
  bookingPetsUuid: string,
  outcome: CheckInOutcome,
  now: Date = new Date(),
): Promise<void> => {
  const target = await findArrivalTarget(bookingPetsUuid);
  if (!target) throw notFound();
  // Only a stay a manager approved is checked in; a request nobody decided is not a booking.
  if (!isConfirmedPet(target.reviewStatus)) {
    throw new AppError('Only an approved stay can be checked in.', 'BOOKING_PET_NOT_ACTIVE', 409);
  }
  if (target.settled) throw alreadySettled();
  if (!target.dropOffAt || newZealandDateOf(now) < newZealandDateOf(target.dropOffAt)) {
    throw new AppError(
      'Arrivals can be recorded from the drop-off day.',
      'CHECK_IN_TOO_EARLY',
      409,
    );
  }
  // Guarded again in SQL: the booking may have been settled or the pet cancelled meanwhile.
  if (!(await saveArrival(bookingPetsUuid, outcome, now))) throw alreadySettled();
  // Care starts when the pet is in. Approval already made the task plan and checking in makes sure
  // it exists; any other outcome means the pet is not staying, and it has none. Creating twice is
  // a no-op.
  if (outcome === 'checked_in') await createTasksForBookingPet(bookingPetsUuid);
  else await deleteTasksForBookingPet(bookingPetsUuid);
};

/**
 * What the recorded outcomes cost under the booking's fee rules, never more than a live hold
 * covers. A booking already charged is capped again when it settles (settleCharged).
 */
const amountDue = (pets: PetAtDesk[], payment: GuaranteePayment, schedule: FeeSchedule): number =>
  capToLiveHold(captureAmountFor(pets, schedule), payment);

const chargeAtDesk = async (
  bookingId: string,
  payment: GuaranteePayment,
  amount: number,
  cards: CardProcessor,
  client: PoolClient,
): Promise<FinishCheckInResponse> => {
  const intent = payment.status === 'authorized' ? payment.paymentIntentId : null;
  if (amount === 0) {
    await releaseGuarantee(payment, client, cards);
    return { result: 'released', amount: 0 };
  }
  if (intent) {
    await withProcessor(() => cards.captureHold(intent, amount, `capture-booking-${bookingId}`));
    await settlePayment(client, payment.paymentId, { status: 'succeeded', capturedAmount: amount });
    return { result: 'charged', amount };
  }
  // No hold was placed in time (the processor could not be reached before drop-off).
  const charge = await withProcessor(() =>
    cards.chargeNow({
      paymentMethodId: payment.paymentMethodId,
      amount,
      reference: toConfirmationNumber(bookingId),
      idempotencyKey: `charge-booking-${bookingId}`,
    }),
  );
  if (charge.status === 'succeeded') {
    await settlePayment(client, payment.paymentId, {
      status: 'succeeded',
      capturedAmount: amount,
      paymentIntentId: charge.paymentIntentId,
    });
    return { result: 'charged', amount };
  }
  await settlePayment(client, payment.paymentId, {
    status: 'failed',
    capturedAmount: null,
    paymentIntentId: charge.paymentIntentId,
  });
  return { result: 'declined', amount };
};

export const finishCheckIn = async (
  bookingId: string,
  dependencies: DeskDependencies = {},
): Promise<FinishCheckInResponse> => {
  const finished = await withLockedBooking(bookingId, async (booking, client) => {
    const payment = openGuaranteeOf(booking);
    const pets = booking.pets.filter((pet) => isConfirmedPet(pet.reviewStatus));
    const atDesk = pets.flatMap((pet) =>
      pet.outcome ? [{ price: pet.price, nightlyRate: pet.nightlyRate, outcome: pet.outcome }] : [],
    );
    if (pets.length === 0 || atDesk.length < pets.length) {
      throw new AppError("Record every pet's arrival first.", 'CHECK_IN_INCOMPLETE', 409);
    }
    const amount = amountDue(atDesk, payment, feeScheduleFor(booking.termsVersion));
    // Paid at request: the confirmed pets were charged already, so what is not owed goes back.
    if (isChargedUnsettled(payment)) {
      const settled = await settleCharged(
        payment,
        amount,
        'desk',
        client,
        dependencies.cardProcessor,
      );
      return settled.kept > 0
        ? { result: 'charged' as const, amount: settled.kept }
        : { result: 'released' as const, amount: 0 };
    }
    // The hold already failed before drop-off: the card is not tried again here.
    if (payment.status === 'failed') return { result: 'card_failed' as const, amount };
    return chargeAtDesk(
      bookingId,
      payment,
      amount,
      processorFor(payment, dependencies.cardProcessor),
      client,
    );
  });
  if (!finished) throw notFound();
  return finished;
};

/**
 * Cancels the whole booking without a fee, for an emergency, a MetService red warning or a pet a
 * vet says is too unwell to board. Only before any pet has arrived; after that the desk outcomes
 * decide what is charged.
 */
export const cancelWithoutFee = async (
  bookingId: string,
  reason: string,
  dependencies: DeskDependencies = {},
): Promise<void> => {
  const cancelled = await withLockedBooking(bookingId, async (booking, client) => {
    if (booking.payment && booking.payment.capturedAmount !== null) throw alreadySettled();
    if (booking.pets.some((pet) => isActivePet(pet.reviewStatus) && pet.outcome)) {
      throw new AppError(
        'A pet has already arrived. Record the outcome at the desk instead.',
        'BOOKING_ALREADY_ARRIVED',
        409,
      );
    }
    const petIds = await cancelActivePets(client, bookingId, reason);
    if (petIds.length === 0) {
      throw new AppError('Nothing is left to cancel on this booking.', 'BOOKING_NOT_ACTIVE', 409);
    }
    if (booking.payment && isChargedUnsettled(booking.payment)) {
      // Wagstay cancels: everything already charged goes back (Consumer Guarantees Act 1993).
      await settleCharged(booking.payment, 0, 'staff-cancel', client, dependencies.cardProcessor);
    } else {
      await releaseGuarantee(booking.payment, client, dependencies.cardProcessor);
    }
    return petIds;
  });
  if (!cancelled) throw notFound();
  // A cancelled pet needs no care plan; its tasks only ever existed for an approved stay.
  for (const bookingPetsUuid of cancelled) await deleteTasksForBookingPet(bookingPetsUuid);
};
