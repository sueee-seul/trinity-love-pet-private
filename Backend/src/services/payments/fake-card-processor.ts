import type {
  CardChargeRequest,
  CardChargeResult,
  CardProcessor,
  CardSetup,
  CardSetupRequest,
  SavedCardSetup,
} from './card-processor.js';

/**
 * A card processor for local development and tests, before the owner has Stripe keys. It never
 * touches a card: every setup succeeds and every hold is granted. The page says it is a test.
 *
 * It keeps no state, so a server restart in the middle of a booking changes nothing: the setup id
 * carries the acceptance it was made for.
 */

const SETUP_PREFIX = 'fake_seti_';
const PAYMENT_METHOD_PREFIX = 'fake_pm_';
const PAYMENT_INTENT_PREFIX = 'fake_pi_';

export class FakeCardProcessor implements CardProcessor {
  readonly name = 'fake' as const;
  readonly publishableKey = null;
  readonly testMode = true;

  async createCardSetup(request: CardSetupRequest): Promise<CardSetup> {
    const setupId = `${SETUP_PREFIX}${request.acceptanceId}`;
    return { setupId, clientSecret: `${setupId}_secret` };
  }

  async readCardSetup(setupId: string): Promise<SavedCardSetup> {
    if (!setupId.startsWith(SETUP_PREFIX)) {
      return { status: 'failed', acceptanceId: null, paymentMethodId: null };
    }
    const acceptanceId = setupId.slice(SETUP_PREFIX.length);
    return {
      status: 'succeeded',
      acceptanceId,
      paymentMethodId: `${PAYMENT_METHOD_PREFIX}${acceptanceId}`,
    };
  }

  async placeHold(request: CardChargeRequest): Promise<CardChargeResult> {
    return {
      status: 'succeeded',
      paymentIntentId: `${PAYMENT_INTENT_PREFIX}${request.idempotencyKey}`,
    };
  }

  async captureHold(): Promise<void> {
    // Nothing to capture: no card was ever held.
  }

  async releaseHold(): Promise<void> {
    // Nothing to release: no card was ever held.
  }

  async refund(): Promise<void> {
    // Nothing to give back: no card was ever charged.
  }

  async chargeNow(request: CardChargeRequest): Promise<CardChargeResult> {
    return {
      status: 'succeeded',
      paymentIntentId: `${PAYMENT_INTENT_PREFIX}${request.idempotencyKey}`,
    };
  }
}
