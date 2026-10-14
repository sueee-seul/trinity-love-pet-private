import Stripe from 'stripe';
import { AppError } from '../../common/middlewares/error.middleware.js';
import type { CardProcessor } from './card-processor.js';
import { FakeCardProcessor } from './fake-card-processor.js';
import { StripeCardProcessor } from './stripe-card-processor.js';

/**
 * Chooses the card processor from the environment:
 * - STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY set: Stripe (test keys move no real money).
 * - CONCIERGE_PAYMENT_MODE=fake outside production: the fake processor, for development before
 *   the owner has Stripe keys.
 * - Otherwise none, and booking online refuses loudly rather than pretend a card was held.
 */

export const FAKE_PAYMENT_MODE = 'fake';

export const createCardProcessor = (
  environment: Record<string, string | undefined> = process.env,
): CardProcessor | null => {
  const secretKey = environment.STRIPE_SECRET_KEY?.trim();
  const publishableKey = environment.STRIPE_PUBLISHABLE_KEY?.trim();
  if (secretKey && publishableKey) {
    return new StripeCardProcessor(new Stripe(secretKey), publishableKey);
  }
  if (
    environment.CONCIERGE_PAYMENT_MODE === FAKE_PAYMENT_MODE &&
    environment.NODE_ENV !== 'production'
  ) {
    return new FakeCardProcessor();
  }
  return null;
};

let configuredProcessor: CardProcessor | null | undefined;

/** The processor for this server, read from the environment once. */
export const getCardProcessor = (): CardProcessor | null => {
  if (configuredProcessor === undefined) configuredProcessor = createCardProcessor();
  return configuredProcessor;
};

/** Tests swap the processor; passing undefined reads the environment again. */
export const setCardProcessorForTests = (processor: CardProcessor | null | undefined): void => {
  configuredProcessor = processor;
};

export const cardPaymentsNotConfigured = (): AppError =>
  new AppError(
    'Card payments are not set up yet. Please contact our team to book.',
    'CONCIERGE_PAYMENTS_NOT_CONFIGURED',
    503,
  );

export const requireCardProcessor = (): CardProcessor => {
  const processor = getCardProcessor();
  if (!processor) throw cardPaymentsNotConfigured();
  return processor;
};
