import type { PoolClient } from 'pg';
import {
  recordCharge,
  settlePayment,
  type GuaranteePayment,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { processorFor, withProcessor } from './booking.guarantee.js';
import type { CardProcessor } from './payments/card-processor.js';

/**
 * Money for pay-at-request bookings (terms concierge-terms-2026-10-02 on): the full price is held
 * when the request is sent, the confirmed pets are charged once nobody is waiting for our manager,
 * and anything not owed is refunded later. Only these bookings keep a room while unpaid, and only
 * for the review window (booking.review-expiry.ts frees it after that).
 *
 * Every call runs inside `withLockedBooking`, so the payment row is locked while money moves, and
 * each processor call carries a key tied to the payment intent, so a retry moves nothing twice.
 */

const toCents = (amount: number): number => Math.round(amount * 100);
const fromCents = (cents: number): number => cents / 100;

/** Charged for the confirmed pets, with nothing settled yet. */
export const isChargedUnsettled = (payment: GuaranteePayment): boolean =>
  payment.status === 'succeeded' && payment.capturedAmount === null;

/** What the confirmed pets cost, never more than the card holds. */
export const confirmedTotal = (pets: PetAtTheDesk[], payment: GuaranteePayment): number =>
  fromCents(
    Math.min(
      pets
        .filter((pet) => pet.reviewStatus === 'approved')
        .reduce((cents, pet) => cents + toCents(pet.price), 0),
      toCents(payment.amount),
    ),
  );

export type DecidedOutcome = 'waiting' | 'charged' | 'released' | 'not_applicable';

/**
 * Once no pet on the booking waits for our manager, the confirmed pets' price is captured from the
 * hold and the processor releases the rest; with no pet confirmed the whole hold is released and
 * the booking settles at nothing. `pets` must already show the decision just made.
 */
export const chargeWhenDecided = async (
  booking: LockedBooking,
  pets: PetAtTheDesk[],
  client: PoolClient,
  processor?: CardProcessor | null,
): Promise<DecidedOutcome> => {
  const { payment } = booking;
  if (!booking.paysAtRequest || !payment || payment.status !== 'authorized') {
    return 'not_applicable';
  }
  if (pets.some((pet) => pet.reviewStatus === 'pending')) return 'waiting';
  const intent = payment.paymentIntentId;
  if (!intent) return 'not_applicable';
  const cards = processorFor(payment, processor);
  const due = confirmedTotal(pets, payment);
  if (due === 0) {
    await withProcessor(() => cards.releaseHold(intent));
    await settlePayment(client, payment.paymentId, { status: 'canceled', capturedAmount: 0 });
    return 'released';
  }
  await withProcessor(() => cards.captureHold(intent, due, `capture-confirmed-${intent}`));
  await recordCharge(client, payment.paymentId, due);
  return 'charged';
};

/**
 * Settles a charged booking at `kept`, refunding the rest to the card. `reason` names the event in
 * the refund key, so the desk and a cancellation can never refund the same payment twice.
 */
export const settleCharged = async (
  payment: GuaranteePayment,
  kept: number,
  reason: string,
  client: PoolClient,
  processor?: CardProcessor | null,
): Promise<{ refunded: number; kept: number }> => {
  const keptCents = Math.min(Math.max(0, toCents(kept)), toCents(payment.amount));
  const refundCents = toCents(payment.amount) - keptCents;
  const intent = payment.paymentIntentId;
  if (refundCents > 0 && intent) {
    const cards = processorFor(payment, processor);
    await withProcessor(() =>
      cards.refund(intent, fromCents(refundCents), `refund-${reason}-${intent}`),
    );
  }
  await settlePayment(client, payment.paymentId, {
    status: keptCents > 0 ? 'succeeded' : 'refunded',
    capturedAmount: fromCents(keptCents),
  });
  return { refunded: fromCents(refundCents), kept: fromCents(keptCents) };
};

/**
 * One charged pet Wagstay will no longer board (refused after confirmation, or turned away): its
 * price goes back, and the booking stays open for the other pets. The last pet settles it.
 */
export const refundChargedPet = async (
  payment: GuaranteePayment,
  pet: PetAtTheDesk,
  othersStillOn: boolean,
  client: PoolClient,
  processor?: CardProcessor | null,
): Promise<void> => {
  const intent = payment.paymentIntentId;
  const refund = Math.min(toCents(pet.price), toCents(payment.amount));
  if (!othersStillOn) {
    await settleCharged(payment, 0, `pet-${pet.bookingPetsUuid}`, client, processor);
    return;
  }
  if (refund > 0 && intent) {
    const cards = processorFor(payment, processor);
    await withProcessor(() =>
      cards.refund(intent, fromCents(refund), `refund-pet-${pet.bookingPetsUuid}-${intent}`),
    );
  }
  await recordCharge(client, payment.paymentId, fromCents(toCents(payment.amount) - refund));
};
