import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withLockedBooking } from '../repositories/booking.check-in.repository.js';
import { chargeWhenDecided } from '../services/booking.settlement.js';
import {
  chargeConfirmedRequest,
  holdRequestPrice,
  releaseUnusedHold,
} from '../services/concierge/concierge.checkout-hold.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { lockedBooking } from './support/lockedBookingFixtures.js';

vi.mock('../repositories/booking.check-in.repository.js', () => ({ withLockedBooking: vi.fn() }));
vi.mock('../services/booking.settlement.js', () => ({ chargeWhenDecided: vi.fn() }));

const cards = new FakeCardProcessor();
const HOLD = { paymentMethodId: 'fake_pm_1', amount: 204, acceptanceId: 'acceptance-1' };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(withLockedBooking).mockReset();
  vi.mocked(chargeWhenDecided).mockReset();
});

describe('holdRequestPrice', () => {
  it('holds the full price once per accepted quote', async () => {
    const placeHold = vi.spyOn(cards, 'placeHold');

    await expect(holdRequestPrice(cards, HOLD)).resolves.toBe('fake_pi_request-hold-acceptance-1');
    expect(placeHold).toHaveBeenCalledWith({
      paymentMethodId: 'fake_pm_1',
      amount: 204,
      reference: 'Wagstay booking request',
      idempotencyKey: 'request-hold-acceptance-1',
    });
  });

  it('refuses the checkout when the bank wants the payment confirmed again', async () => {
    vi.spyOn(cards, 'placeHold').mockResolvedValue({
      status: 'failed',
      paymentIntentId: null,
      reason: 'authentication_required',
    });

    await expect(holdRequestPrice(cards, HOLD)).rejects.toMatchObject({
      code: 'CONCIERGE_CARD_AUTHENTICATION_REQUIRED',
      statusCode: 402,
    });
  });

  it('reports a processor that cannot be reached as a retryable error', async () => {
    vi.spyOn(cards, 'placeHold').mockRejectedValue(new Error('network'));

    await expect(holdRequestPrice(cards, HOLD)).rejects.toMatchObject({
      code: 'CARD_PROCESSOR_ERROR',
      statusCode: 502,
    });
  });
});

describe('releaseUnusedHold', () => {
  it('logs instead of throwing, so the guest hears the real failure', async () => {
    vi.spyOn(cards, 'releaseHold').mockRejectedValue(new Error('network'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(releaseUnusedHold(cards, 'fake_pi_1')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('chargeConfirmedRequest', () => {
  it('charges in the locked booking', async () => {
    const booking = lockedBooking({ paysAtRequest: true });
    vi.mocked(withLockedBooking).mockImplementation(async (_id, work) =>
      work(booking, {} as never),
    );
    vi.mocked(chargeWhenDecided).mockResolvedValue('charged');

    await expect(chargeConfirmedRequest('booking-1', cards)).resolves.toBe('charged');
    expect(chargeWhenDecided).toHaveBeenCalledWith(booking, booking.pets, {}, cards);
  });

  it('leaves the hold for the review job when the charge cannot be made now', async () => {
    vi.mocked(withLockedBooking).mockRejectedValue(new Error('processor down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(chargeConfirmedRequest('booking-1', cards)).resolves.toBe('waiting');
  });
});
