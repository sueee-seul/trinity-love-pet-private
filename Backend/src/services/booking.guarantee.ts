import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import { awaitNewHold } from '../repositories/booking.change.repository.js';
import {
  settlePayment,
  type GuaranteePayment,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import type { CardProcessor } from './payments/card-processor.js';
import { getCardProcessor } from './payments/card-processor.factory.js';

/**
 * Shared by everything that changes a booking made with a saved card: the desk, a guest cancelling
 * or moving their stay, and staff exceptions. Each works inside `withLockedBooking`.
 */

export interface GuaranteeDependencies {
  /** The processor to use; this server's own when left out. */
  cardProcessor?: CardProcessor | null;
  now?: Date;
}

export const bookingNotFound = (): AppError => new AppError('Booking not found', 'NOT_FOUND', 404);

/**
 * A capture can never take more than the hold, so a live hold caps the amount. Without one the
 * stored amount is no limit: after the approved pets change it is still the released hold's
 * total, and the charge is made afresh from the saved card for what the outcomes cost.
 */
export const capToLiveHold = (amount: number, payment: GuaranteePayment): number =>
  payment.status === 'authorized' ? Math.min(amount, payment.amount) : amount;

export const alreadySettled = (): AppError =>
  new AppError(
    'Check-in is already finished for this booking, or it was cancelled.',
    'BOOKING_SETTLED',
    409,
  );

/** The processor the card was saved with, or 503 when this server does not run it. */
export const processorFor = (
  payment: GuaranteePayment,
  processor: CardProcessor | null | undefined,
): CardProcessor => {
  const cards = processor === undefined ? getCardProcessor() : processor;
  if (!cards || cards.name !== payment.processor) {
    throw new AppError(
      'Card payments are not set up on this server, so this card cannot be charged.',
      'PAYMENTS_NOT_CONFIGURED',
      503,
    );
  }
  return cards;
};

/** Processor trouble is reported plainly; every call made through it is safe to repeat. */
export const withProcessor = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch {
    throw new AppError(
      'The card could not be charged just now. Try again, or take payment at the desk.',
      'CARD_PROCESSOR_ERROR',
      502,
    );
  }
};

/** A card-guaranteed booking whose money has not been settled yet. */
export const openGuaranteeOf = (booking: LockedBooking): GuaranteePayment => {
  const { payment } = booking;
  if (!payment) {
    throw new AppError(
      'This booking was not made with a saved card.',
      'BOOKING_NOT_CARD_GUARANTEED',
      409,
    );
  }
  // A pay-at-request booking stays open after its confirmed pets were charged ('succeeded' with
  // nothing settled yet): the desk or a cancellation still refunds what is not owed.
  const open =
    payment.status === 'pending' ||
    payment.status === 'authorized' ||
    payment.status === 'failed' ||
    payment.status === 'succeeded';
  if (!open || payment.capturedAmount !== null) throw alreadySettled();
  return payment;
};

/**
 * Releases a hold in full, or stops one from being placed, and settles the payment at nothing.
 * For bookings without a saved card there is nothing to do.
 */
export const releaseGuarantee = async (
  payment: GuaranteePayment | null,
  client: PoolClient,
  processor?: CardProcessor | null,
): Promise<void> => {
  if (!payment) return;
  if (payment.status === 'authorized' && payment.paymentIntentId) {
    const intent = payment.paymentIntentId;
    const cards = processorFor(payment, processor);
    await withProcessor(() => cards.releaseHold(intent));
  }
  await settlePayment(client, payment.paymentId, { status: 'canceled', capturedAmount: 0 });
};

/**
 * The pets a manager has agreed to changed after the price was held, so the hold no longer matches
 * what is owed. It is released, and the 48-hour job holds the new total of the approved pets. A
 * booking with no hold yet needs nothing: the job reads the approved pets when it runs.
 */
export const releaseHoldForNewTotal = async (
  bookingId: string,
  payment: GuaranteePayment | null,
  client: PoolClient,
  processor?: CardProcessor | null,
): Promise<void> => {
  if (!payment || payment.status !== 'authorized' || !payment.paymentIntentId) return;
  const intent = payment.paymentIntentId;
  const cards = processorFor(payment, processor);
  await withProcessor(() => cards.releaseHold(intent));
  await awaitNewHold(client, bookingId, payment.paymentId);
};
