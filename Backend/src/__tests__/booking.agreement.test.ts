import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  currentAgreementTerms,
  agreementName,
  BOOKING_TERMS_VERSION,
  findAgreedTerms,
  readCurrentAgreementTerms,
} from '../repositories/booking.agreement.repository.js';
import { conciergeCheckoutSchema } from '../contracts/concierge.contract.js';
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('single recorded agreement', () => {
  it('rejects stale client terms before reading a name or writing a booking', async () => {
    await expect(currentAgreementTerms('old-version')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TERMS_VERSION_CHANGED',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });
  it('rejects an unapplied terms version', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    await expect(currentAgreementTerms(BOOKING_TERMS_VERSION)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('locks and returns the exact current version in the booking transaction', async () => {
    const query = vi.fn<(sql: string, params: string[]) => Promise<{ rows: { id: string }[] }>>(
      async () => ({
        rows: [{ id: 'terms-id' }],
      }),
    );
    await expect(currentAgreementTerms(BOOKING_TERMS_VERSION, { query } as never)).resolves.toBe(
      'terms-id',
    );
    expect(query.mock.calls[0]?.[0]).toContain('FOR SHARE');
  });
  it('reads the full text of the version this release shows, and nothing older', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ content: 'full terms' }] } as never);
    await expect(readCurrentAgreementTerms()).resolves.toBe('full terms');
    expect(vi.mocked(pool.query).mock.calls[0]?.[1]).toEqual([
      `Wagstay booking terms, version ${BOOKING_TERMS_VERSION}`,
    ]);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    await expect(readCurrentAgreementTerms()).resolves.toBeNull();
  });
  it('reads the text a booking agreed to, whichever version is current now', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ content: 'agreed terms' }] } as never);
    await expect(findAgreedTerms('booking-id')).resolves.toBe('agreed terms');
    const [sql, params] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(sql)).toContain('bookings_agreements');
    expect(String(sql)).not.toContain('is_current');
    expect(params).toEqual(['booking-id']);
  });
  it('reads the signer from the owner record and refuses a missing name', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ name: 'Ava Mitchell' }] } as never);
    await expect(agreementName('owner-id')).resolves.toBe('Ava Mitchell');
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ name: '' }] } as never);
    await expect(agreementName('owner-id')).rejects.toMatchObject({
      code: 'AGREEMENT_NAME_MISSING',
    });
  });
  it('needs affirmative consent but does not accept a client-supplied signature name', () => {
    const schema = conciergeCheckoutSchema.shape.agreement;
    const bothTicks = {
      termsAccepted: true,
      vetConsentAccepted: true,
      termsVersionLabel: BOOKING_TERMS_VERSION,
    };
    expect(schema.safeParse(bothTicks).success).toBe(true);
    expect(schema.safeParse({ ...bothTicks, termsAccepted: false }).success).toBe(false);
    // Emergency vet consent is its own tick, and the server refuses a request without it.
    expect(schema.safeParse({ ...bothTicks, vetConsentAccepted: false }).success).toBe(false);
    expect(
      schema.safeParse({ termsAccepted: true, termsVersionLabel: BOOKING_TERMS_VERSION }).success,
    ).toBe(false);
    expect(
      schema.parse({
        fullName: 'Forged Name',
        termsAccepted: true,
        vetConsentAccepted: true,
        termsVersionLabel: BOOKING_TERMS_VERSION,
      }),
    ).not.toHaveProperty('fullName');
  });
});
