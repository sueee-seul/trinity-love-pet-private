import { describe, expect, it } from 'vitest';
import { createCardProcessor } from '../services/payments/card-processor.factory.js';

describe('createCardProcessor', () => {
  it('uses the fake only when asked for, and never in production', () => {
    expect(createCardProcessor({ CONCIERGE_PAYMENT_MODE: 'fake' })?.name).toBe('fake');
    expect(
      createCardProcessor({ CONCIERGE_PAYMENT_MODE: 'fake', NODE_ENV: 'production' }),
    ).toBeNull();
    expect(createCardProcessor({})).toBeNull();
  });

  it('ignores Stripe keys: nothing is paid online', () => {
    expect(
      createCardProcessor({
        STRIPE_SECRET_KEY: 'sk_test_abc',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
      }),
    ).toBeNull();
  });
});
