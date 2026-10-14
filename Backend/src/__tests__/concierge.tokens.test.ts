import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  signAcceptedQuote,
  signQuote,
  signVerifiedEmail,
  verifyAcceptedQuote,
  verifyQuote,
  verifyVerifiedEmail,
  type SignedQuote,
} from '../services/concierge/concierge.tokens.js';
import { TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';

/** Relative to now: accepted-quote tokens expire after an hour, so a fixed date would rot. */
const ACCEPTED_AT = new Date(Date.now() - 60_000);

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
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  nights: 3,
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: true }],
  lines: [
    {
      serviceId: '11111111-1111-4111-8111-000000000002',
      petIndex: 0,
      quantity: 1,
      unitPrice: 60,
      lineTotal: 180,
    },
  ],
  total: 180,
  currency: 'NZD',
};

describe('concierge tokens', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  it('round-trips a quote and an acceptance', async () => {
    const { token } = await signQuote(quote);
    const verified = await verifyQuote(token);
    const accepted = await verifyAcceptedQuote(await signAcceptedQuote(verified, ACCEPTED_AT));

    expect(verified).toEqual(quote);
    expect(accepted.acceptedAt).toBe(ACCEPTED_AT.toISOString());
    expect(accepted.quote.total).toBe(180);
  });

  it('will not accept a plain quote where an accepted quote is required', async () => {
    const { token } = await signQuote(quote);

    await expect(verifyAcceptedQuote(token)).rejects.toMatchObject({
      code: 'CONCIERGE_TOKEN_INVALID',
      details: [{ token: 'accepted_quote' }],
    });
  });

  it('will not accept a quote as a verified email', async () => {
    const { token } = await signQuote(quote);

    await expect(verifyVerifiedEmail(token)).rejects.toMatchObject({
      code: 'CONCIERGE_TOKEN_INVALID',
      details: [{ token: 'verified_email' }],
    });
  });

  it('rejects a tampered quote', async () => {
    const { token } = await signQuote(quote);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ typ: 'concierge_quote', quote: { ...quote, total: 1 } }),
    ).toString('base64url');

    await expect(verifyQuote(`${header}.${forgedPayload}.${signature}`)).rejects.toMatchObject({
      code: 'CONCIERGE_TOKEN_INVALID',
    });
  });

  it('rejects an expired quote', async () => {
    const { token } = await signQuote(quote, new Date(Date.now() - 2 * 60 * 60 * 1000));

    await expect(verifyQuote(token)).rejects.toMatchObject({ code: 'CONCIERGE_TOKEN_INVALID' });
  });

  it('round-trips a verified email', async () => {
    expect(await verifyVerifiedEmail(await signVerifiedEmail('ava@example.test'))).toBe(
      'ava@example.test',
    );
  });

  it('reports a missing signing secret as not configured', async () => {
    delete process.env.CONCIERGE_SIGNING_SECRET;

    await expect(signQuote(quote)).rejects.toMatchObject({
      code: 'CONCIERGE_NOT_CONFIGURED',
      statusCode: 503,
    });
  });
});
