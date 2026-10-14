import { AppError } from '../../common/middlewares/error.middleware.js';
import { withLockedBooking } from '../../repositories/booking.check-in.repository.js';
import { withProcessor } from '../booking.guarantee.js';
import { chargeWhenDecided, type DecidedOutcome } from '../booking.settlement.js';
import type { CardProcessor } from '../payments/card-processor.js';

/**
 * The card at checkout under the pay-at-request terms. The guest has just confirmed the card in the
 * page, so the full price is held before the request is recorded: a declined card books nothing,
 * and only a request with money behind it takes a room. If recording then fails, the hold is let go
 * so the guest is not left with money held for nothing.
 */

export interface RequestHold {
  paymentMethodId: string;
  amount: number;
  acceptanceId: string;
}

const declined = (reason: 'declined' | 'authentication_required'): AppError =>
  reason === 'authentication_required'
    ? new AppError(
        'Your bank asked to confirm this payment. Please add your card again, or try another card.',
        'CONCIERGE_CARD_AUTHENTICATION_REQUIRED',
        402,
      )
    : new AppError(
        'Your card was declined, so nothing was booked. Please try another card.',
        'CONCIERGE_CARD_DECLINED',
        402,
      );

/** Holds the request's full price; returns the hold, or refuses the checkout when declined. */
export const holdRequestPrice = async (
  cards: CardProcessor,
  hold: RequestHold,
): Promise<string> => {
  const result = await withProcessor(() =>
    cards.placeHold({
      paymentMethodId: hold.paymentMethodId,
      amount: hold.amount,
      reference: 'Wagstay booking request',
      // One hold per accepted quote: a retried checkout finds the same hold, never a second one.
      idempotencyKey: `request-hold-${hold.acceptanceId}`,
    }),
  );
  if (result.status !== 'succeeded') throw declined(result.reason);
  return result.paymentIntentId;
};

/**
 * Lets the hold go after the request could not be recorded. A failure here is logged, not thrown:
 * the guest needs to hear why the booking failed, and an unused hold lapses on its own.
 */
export const releaseUnusedHold = async (cards: CardProcessor, intent: string): Promise<void> => {
  try {
    await cards.releaseHold(intent);
  } catch (error: unknown) {
    console.error('Could not release the hold of a request that was not recorded', {
      name: error instanceof Error ? error.name : 'unknown',
    });
  }
};

/**
 * Every pet was confirmed at checkout: their price is charged now. If the processor cannot be
 * reached, the hold stays and the review job charges it on its next run (booking.review-expiry.ts).
 */
export const chargeConfirmedRequest = async (
  bookingId: string,
  cards: CardProcessor,
): Promise<DecidedOutcome> => {
  try {
    const outcome = await withLockedBooking(bookingId, (booking, client) =>
      chargeWhenDecided(booking, booking.pets, client, cards),
    );
    return outcome ?? 'not_applicable';
  } catch (error: unknown) {
    console.error('Could not charge a confirmed request at checkout; the review job retries', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    return 'waiting';
  }
};
