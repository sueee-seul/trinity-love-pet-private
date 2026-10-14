import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConciergeCardSetup,
  readGuaranteeCard,
} from '../services/concierge/concierge.card-guarantee.js';
import { signAcceptedQuote, type SignedQuote } from '../services/concierge/concierge.tokens.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';

const quote: SignedQuote = {
  name: 'Garden suite',
  selection: {
    pets: [
      {
        roomId: '11111111-1111-4111-8111-000000000002',
        foodId: '11111111-1111-4111-8111-000000000004',
        addonIds: [],
      },
    ],
  },
  startDate: '2026-12-12',
  endDate: '2026-12-15',
  nights: 3,
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: true }],
  lines: [
    {
      serviceId: '11111111-1111-4111-8111-000000000002',
      petIndex: 0,
      quantity: 1,
      unitPrice: 68,
      lineTotal: 204,
    },
  ],
  total: 204,
  currency: 'NZD',
};

describe('concierge card guarantee', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it('saves a card for a signed-in owner under their account email', async () => {
    const processor = new FakeCardProcessor();
    const createCardSetup = vi.spyOn(processor, 'createCardSetup');

    const setup = await createConciergeCardSetup(
      { acceptedQuoteToken: await signAcceptedQuote(quote, new Date(Date.now() - 60_000)) },
      { signedInEmail: 'owner@example.test' },
      processor,
    );

    expect(createCardSetup.mock.calls[0]?.[0].email).toBe('owner@example.test');
    expect(setup).toMatchObject({ processor: 'fake', testMode: true, publishableKey: null });
  });

  it('refuses a setup that the guest has not confirmed yet', async () => {
    const processor = new FakeCardProcessor();
    vi.spyOn(processor, 'readCardSetup').mockResolvedValue({
      status: 'pending',
      acceptanceId: 'acceptance-1',
      paymentMethodId: null,
    });

    await expect(readGuaranteeCard(processor, 'seti_1', 'acceptance-1')).rejects.toMatchObject({
      code: 'CONCIERGE_CARD_NOT_READY',
      statusCode: 409,
    });
  });
});
