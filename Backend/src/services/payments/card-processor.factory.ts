import { AppError } from '../../common/middlewares/error.middleware.js';
import type { CardProcessor } from './card-processor.js';
import { FakeCardProcessor } from './fake-card-processor.js';

/**
 * Nothing is paid online (owner decision 2026-10-14), so there is no real card processor: Stripe
 * was removed. What remains serves the bookings made before that, whose money code still runs
 * when a booking has a payment row:
 * - CONCIERGE_PAYMENT_MODE=fake outside production: the fake processor, for development and tests.
 * - Otherwise none: every money step on such a booking is skipped or refused loudly.
 */
export const FAKE_PAYMENT_MODE = 'fake';

export const createCardProcessor = (
  environment: Record<string, string | undefined> = process.env,
): CardProcessor | null => {
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
