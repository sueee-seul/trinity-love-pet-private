import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardProcessor } from '../services/payments/card-processor.js';
import {
  chargeWhenDecided,
  refundChargedPet,
  settleCharged,
} from '../services/booking.settlement.js';
import { recordCharge, settlePayment } from '../repositories/booking.check-in.repository.js';
import {
  chargedBooking,
  guaranteePayment,
  lockedBooking,
  lockedPet,
} from './support/lockedBookingFixtures.js';

vi.mock('../repositories/booking.check-in.repository.js', () => ({
  recordCharge: vi.fn(),
  settlePayment: vi.fn(),
}));

const client = {} as PoolClient;

const cards = {
  name: 'stripe' as const,
  publishableKey: 'pk_test_1',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn(),
  captureHold: vi.fn<CardProcessor['captureHold']>(async () => undefined),
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
  chargeNow: vi.fn(),
  refund: vi.fn<CardProcessor['refund']>(async () => undefined),
} satisfies CardProcessor;

/** A pay-at-request booking with its $460 for two pets still held. */
const heldRequest = lockedBooking({ paysAtRequest: true });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chargeWhenDecided', () => {
  it('waits while a pet still waits for our manager', async () => {
    const pets = [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'pending' })];

    await expect(chargeWhenDecided(heldRequest, pets, client, cards)).resolves.toBe('waiting');
    expect(cards.captureHold).not.toHaveBeenCalled();
  });

  it('charges the confirmed pets once everyone is decided, and the rest of the hold goes', async () => {
    const pets = [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'refused' })];

    await expect(chargeWhenDecided(heldRequest, pets, client, cards)).resolves.toBe('charged');
    expect(cards.captureHold).toHaveBeenCalledWith('pi_held', 230, 'capture-confirmed-pi_held');
    expect(recordCharge).toHaveBeenCalledWith(client, 'payment-1', 230);
  });

  it('releases the whole hold and settles at nothing when no pet was confirmed', async () => {
    const pets = [
      lockedPet({ reviewStatus: 'refused' }),
      lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'refused' }),
    ];

    await expect(chargeWhenDecided(heldRequest, pets, client, cards)).resolves.toBe('released');
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
  });

  it('leaves bookings made under the older terms to the 48-hour hold and the desk', async () => {
    await expect(
      chargeWhenDecided(lockedBooking(), lockedBooking().pets, client, cards),
    ).resolves.toBe('not_applicable');
    expect(cards.captureHold).not.toHaveBeenCalled();
  });

  it('does nothing to a booking already charged', async () => {
    const booking = chargedBooking();
    await expect(chargeWhenDecided(booking, booking.pets, client, cards)).resolves.toBe(
      'not_applicable',
    );
  });
});

describe('settleCharged', () => {
  it('keeps the fee and refunds the rest, keyed to the event', async () => {
    const payment = guaranteePayment({ status: 'succeeded', paymentIntentId: 'pi_charged' });

    await expect(settleCharged(payment, 60, 'cancel', client, cards)).resolves.toEqual({
      refunded: 400,
      kept: 60,
    });
    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 400, 'refund-cancel-pi_charged');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 60,
    });
  });

  it('marks a full refund as refunded', async () => {
    const payment = guaranteePayment({ status: 'succeeded', paymentIntentId: 'pi_charged' });

    await settleCharged(payment, 0, 'staff-cancel', client, cards);

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-staff-cancel-pi_charged');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'refunded',
      capturedAmount: 0,
    });
  });

  it('refunds nothing when everything is owed', async () => {
    const payment = guaranteePayment({ status: 'succeeded', paymentIntentId: 'pi_charged' });

    await settleCharged(payment, 460, 'desk', client, cards);

    expect(cards.refund).not.toHaveBeenCalled();
  });
});

describe('refundChargedPet', () => {
  const payment = guaranteePayment({ status: 'succeeded', paymentIntentId: 'pi_charged' });

  it('gives one pet its price back while another stays on the booking', async () => {
    await refundChargedPet(payment, lockedPet({ bookingPetsUuid: 'pet-b' }), true, client, cards);

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 230, 'refund-pet-pet-b-pi_charged');
    expect(recordCharge).toHaveBeenCalledWith(client, 'payment-1', 230);
  });

  it('settles the booking when the last pet goes', async () => {
    await refundChargedPet(payment, lockedPet(), false, client, cards);

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-pet-pet-a-pi_charged');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'refunded',
      capturedAmount: 0,
    });
  });
});
