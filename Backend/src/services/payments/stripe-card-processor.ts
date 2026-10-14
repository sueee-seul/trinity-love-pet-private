import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import {
  toCents,
  type CardChargeRequest,
  type CardChargeResult,
  type CardProcessor,
  type CardSetup,
  type CardSetupRequest,
  type SavedCardSetup,
} from './card-processor.js';

/**
 * Stripe behind the CardProcessor interface.
 *
 * - Cards are saved with a SetupIntent for off-session use, so the hold 48 hours before drop-off
 *   can be placed while the guest is away (a merchant-initiated payment).
 * - A hold is a PaymentIntent with capture_method 'manual', confirmed off-session. Stripe keeps an
 *   online card hold for 7 days (Visa merchant-initiated: 4 days 18 hours), which is why the hold
 *   is placed 48 hours ahead and never at a booking made weeks ahead.
 * - Every request that can move money carries an idempotency key.
 * See docs.stripe.com/payments/place-a-hold-on-a-payment-method and /payments/save-and-reuse.
 */

const CURRENCY = 'nzd';
const ACCEPTANCE_METADATA_KEY = 'acceptance_id';

const emailKey = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : (value?.id ?? null);

const setupStatus = (status: string): SavedCardSetup['status'] => {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'canceled') return 'failed';
  return 'pending';
};

/** A card error is a result the guest can act on; anything else is thrown for a retry. */
const cardFailure = (error: unknown): CardChargeResult | null => {
  if (!(error instanceof Stripe.errors.StripeCardError)) return null;
  return {
    status: 'failed',
    paymentIntentId: error.payment_intent?.id ?? null,
    reason: error.code === 'authentication_required' ? 'authentication_required' : 'declined',
  };
};

export class StripeCardProcessor implements CardProcessor {
  readonly name = 'stripe' as const;
  readonly testMode: boolean;

  constructor(
    private readonly stripe: Stripe,
    readonly publishableKey: string,
  ) {
    this.testMode = publishableKey.startsWith('pk_test_');
  }

  async createCardSetup(request: CardSetupRequest): Promise<CardSetup> {
    const customerId = await this.customerFor(request.email);
    const setup = await this.stripe.setupIntents.create(
      {
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: { [ACCEPTANCE_METADATA_KEY]: request.acceptanceId },
      },
      { idempotencyKey: `card-setup-${request.acceptanceId}-${emailKey(request.email)}` },
    );
    if (!setup.client_secret) throw new Error('Stripe returned a card setup without a secret');
    return { setupId: setup.id, clientSecret: setup.client_secret };
  }

  async readCardSetup(setupId: string): Promise<SavedCardSetup> {
    const setup = await this.stripe.setupIntents.retrieve(setupId);
    return {
      status: setupStatus(setup.status),
      acceptanceId: setup.metadata?.[ACCEPTANCE_METADATA_KEY] ?? null,
      paymentMethodId: idOf(setup.payment_method),
    };
  }

  async placeHold(request: CardChargeRequest): Promise<CardChargeResult> {
    return this.confirmOffSession(request, 'manual');
  }

  async captureHold(
    paymentIntentId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<void> {
    await this.stripe.paymentIntents.capture(
      paymentIntentId,
      { amount_to_capture: toCents(amount) },
      { idempotencyKey },
    );
  }

  async releaseHold(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error: unknown) {
      // A hold that expired or was released before is already where it should be.
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'canceled') throw error;
    }
  }

  async chargeNow(request: CardChargeRequest): Promise<CardChargeResult> {
    return this.confirmOffSession(request, 'automatic');
  }

  async refund(paymentIntentId: string, amount: number, idempotencyKey: string): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId, amount: toCents(amount), reason: 'requested_by_customer' },
      { idempotencyKey },
    );
  }

  /** Reuses the Stripe customer for an email, so a returning guest's cards stay together. */
  private async customerFor(email: string): Promise<string> {
    const existing = await this.stripe.customers.list({ email, limit: 1 });
    const [customer] = existing.data;
    if (customer) return customer.id;
    const created = await this.stripe.customers.create(
      { email, metadata: { source: 'wagstay-booking' } },
      { idempotencyKey: `customer-${emailKey(email)}` },
    );
    return created.id;
  }

  private async confirmOffSession(
    request: CardChargeRequest,
    captureMethod: 'manual' | 'automatic',
  ): Promise<CardChargeResult> {
    const paymentMethod = await this.stripe.paymentMethods.retrieve(request.paymentMethodId);
    const customerId = idOf(paymentMethod.customer);
    if (!customerId) throw new Error('The saved card is not attached to a Stripe customer');
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: toCents(request.amount),
          currency: CURRENCY,
          customer: customerId,
          payment_method: request.paymentMethodId,
          capture_method: captureMethod,
          confirm: true,
          off_session: true,
          description: `Wagstay booking ${request.reference}`,
          metadata: { booking_reference: request.reference },
        },
        { idempotencyKey: request.idempotencyKey },
      );
      const expected = captureMethod === 'manual' ? 'requires_capture' : 'succeeded';
      if (intent.status === expected) return { status: 'succeeded', paymentIntentId: intent.id };
      throw new Error(`Stripe left the payment in status ${intent.status}`);
    } catch (error: unknown) {
      const failure = cardFailure(error);
      if (failure) return failure;
      throw error;
    }
  }
}
