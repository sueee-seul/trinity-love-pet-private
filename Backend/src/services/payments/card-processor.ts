/**
 * The one door to card payments. Booking code talks to this interface, never to Stripe directly,
 * so the rules in booking.fee-policy.ts decide amounts and timing, and the processor only moves
 * money when told to.
 *
 * Money flow for a booking:
 * 1. At checkout the guest confirms a card in the page (a setup the processor authenticates), and
 *    the server holds the full price on it before the request is recorded. A declined card books
 *    nothing.
 * 2. Once every pet is decided, the confirmed pets' price is captured; the rest is released. A
 *    request nobody decided within 24 hours is released in full.
 * 3. A cancellation or the desk refunds what is not owed under the fee rules.
 * Older bookings (before the 2026-10-02 terms) were held 48 hours before drop-off and captured at
 * the desk; those keep that path.
 *
 * Amounts are NZD dollars here; each processor converts to its own unit.
 */

export type CardProcessorName = 'stripe' | 'fake';

export interface CardSetupRequest {
  email: string;
  /** Ties the saved card to one accepted quote, so a card saved for one booking books only that. */
  acceptanceId: string;
}

export interface CardSetup {
  setupId: string;
  /** Handed to the card form in the browser, which confirms the setup with the processor. */
  clientSecret: string;
}

export interface SavedCardSetup {
  status: 'succeeded' | 'pending' | 'failed';
  acceptanceId: string | null;
  paymentMethodId: string | null;
}

export interface CardChargeRequest {
  paymentMethodId: string;
  amount: number;
  /** Shown to the guest's bank and kept on the processor's record, e.g. the booking reference. */
  reference: string;
  /** The same key never moves money twice, whatever retries happen. */
  idempotencyKey: string;
}

/** Why the card could not be held or charged. `authentication_required`: the bank wants 3-D Secure. */
export type CardFailureReason = 'declined' | 'authentication_required';

export type CardChargeResult =
  | { status: 'succeeded'; paymentIntentId: string }
  | { status: 'failed'; paymentIntentId: string | null; reason: CardFailureReason };

export interface CardProcessor {
  readonly name: CardProcessorName;
  /** Browser-safe key for the card form; null when there is no real card form (fake mode). */
  readonly publishableKey: string | null;
  /** True for Stripe test keys and fake mode: no real money moves. */
  readonly testMode: boolean;
  createCardSetup(request: CardSetupRequest): Promise<CardSetup>;
  readCardSetup(setupId: string): Promise<SavedCardSetup>;
  /**
   * Holds the amount on the card without charging it. A decline is a result, not an error; an
   * error means the processor could not be reached and the caller may try again later.
   */
  placeHold(request: CardChargeRequest): Promise<CardChargeResult>;
  /** Captures part or all of a hold; the rest is released by the processor. */
  captureHold(paymentIntentId: string, amount: number, idempotencyKey: string): Promise<void>;
  /** Releases a hold without charging anything. Releasing an already released hold is fine. */
  releaseHold(paymentIntentId: string): Promise<void>;
  /** Charges at once, for a late cancellation made before any hold was placed. */
  chargeNow(request: CardChargeRequest): Promise<CardChargeResult>;
  /**
   * Gives back part or all of a captured payment. The processor keeps its own fee; Wagstay bears
   * it. Repeating a refund with the same key gives nothing back twice.
   */
  refund(paymentIntentId: string, amount: number, idempotencyKey: string): Promise<void>;
}

/** NZD dollars to the processor's smallest unit. */
export const toCents = (amount: number): number => Math.round(amount * 100);
