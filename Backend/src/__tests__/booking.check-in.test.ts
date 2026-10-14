import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import {
  cancelActivePets,
  findArrivalTarget,
  saveArrival,
  settlePayment,
  withLockedBooking,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { cancelWithoutFee, finishCheckIn, recordArrival } from '../services/booking.check-in.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import {
  guaranteePayment,
  LOCKED_BOOKING_ID,
  lockedBooking as buildLockedBooking,
  lockedPet,
} from './support/lockedBookingFixtures.js';
import {
  createTasksForBookingPet,
  deleteTasksForBookingPet,
} from '../services/task.fromBooking.service.js';

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  findArrivalTarget: vi.fn(),
  saveArrival: vi.fn(),
  withLockedBooking: vi.fn(),
  settlePayment: vi.fn(),
  cancelActivePets: vi.fn(),
}));

vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(async () => undefined),
  deleteTasksForBookingPet: vi.fn(async () => undefined),
}));

const BOOKING_ID = LOCKED_BOOKING_ID;
const client = {} as PoolClient;

const pet = (outcome: CheckInOutcome | null, overrides: Partial<PetAtTheDesk> = {}): PetAtTheDesk =>
  lockedPet({ bookingPetsUuid: `pet-${Math.random()}`, outcome, ...overrides });

const payment = guaranteePayment;

/** The booking `withLockedBooking` hands over, as if its payment row were locked. */
const lockedBooking = (booking: Partial<LockedBooking>): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_bookingId, work) =>
    work(buildLockedBooking({ pets: [], ...booking }), client),
  );
};

const processor = (): CardProcessor => ({
  name: 'stripe',
  publishableKey: 'pk_test_example',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn(),
  captureHold: vi.fn<CardProcessor['captureHold']>(async () => undefined),
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
  refund: vi.fn<CardProcessor['refund']>(async () => undefined),
  chargeNow: vi.fn<CardProcessor['chargeNow']>(async () => ({
    status: 'succeeded',
    paymentIntentId: 'pi_charged',
  })),
});

let cards: CardProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  cards = processor();
});

describe('recording an arrival', () => {
  // 10:30 on Sat 12 Dec 2026 in Auckland.
  const dropOffAt = new Date('2026-12-11T21:30:00Z');
  const target = {
    bookingId: BOOKING_ID,
    reviewStatus: 'approved',
    outcome: null,
    dropOffAt,
    settled: false,
  };

  it('records it from the drop-off day in Auckland, even before the drop-off time', async () => {
    vi.mocked(findArrivalTarget).mockResolvedValue(target);
    vi.mocked(saveArrival).mockResolvedValue(true);
    // 08:00 on the drop-off day.
    const now = new Date('2026-12-11T19:00:00Z');

    await recordArrival('booking-pet-1', 'checked_in', now);

    expect(saveArrival).toHaveBeenCalledWith('booking-pet-1', 'checked_in', now);
  });

  it('gives a checked-in pet its care tasks, and takes them away for any other outcome', async () => {
    vi.mocked(findArrivalTarget).mockResolvedValue(target);
    vi.mocked(saveArrival).mockResolvedValue(true);

    await recordArrival('booking-pet-1', 'checked_in', dropOffAt);
    expect(createTasksForBookingPet).toHaveBeenCalledWith('booking-pet-1');
    expect(deleteTasksForBookingPet).not.toHaveBeenCalled();

    // Staff corrected it: the pet did not come after all.
    await recordArrival('booking-pet-1', 'no_show', dropOffAt);
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('booking-pet-1');
    expect(createTasksForBookingPet).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the day before drop-off', target, new Date('2026-12-11T10:00:00Z'), 'CHECK_IN_TOO_EARLY'],
    ['a refused pet', { ...target, reviewStatus: 'refused' }, dropOffAt, 'BOOKING_PET_NOT_ACTIVE'],
    ['a settled booking', { ...target, settled: true }, dropOffAt, 'BOOKING_SETTLED'],
  ])('refuses %s', async (_label, found, now, code) => {
    vi.mocked(findArrivalTarget).mockResolvedValue(found);

    await expect(recordArrival('booking-pet-1', 'no_show', now)).rejects.toMatchObject({
      code,
      statusCode: 409,
    });
    expect(saveArrival).not.toHaveBeenCalled();
  });

  it('says so when the booking was settled while the desk was typing', async () => {
    vi.mocked(findArrivalTarget).mockResolvedValue(target);
    vi.mocked(saveArrival).mockResolvedValue(false);

    await expect(recordArrival('booking-pet-1', 'no_show', dropOffAt)).rejects.toMatchObject({
      code: 'BOOKING_SETTLED',
    });
  });
});

describe('finishing check-in', () => {
  it.each([
    ['both pets checked in', ['checked_in', 'checked_in'], 460],
    ['one checked in, one no-show', ['checked_in', 'no_show'], 290],
    ['both no-shows', ['no_show', 'no_show'], 120],
  ] as const)('captures once from the hold: %s', async (_label, outcomes, amount) => {
    lockedBooking({ pets: outcomes.map((outcome) => pet(outcome)) });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'charged',
      amount,
    });

    expect(cards.captureHold).toHaveBeenCalledWith(
      'pi_held',
      amount,
      `capture-booking-${BOOKING_ID}`,
    );
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: amount,
    });
  });

  it('releases the whole hold when Wagstay could not take any pet', async () => {
    lockedBooking({ pets: [pet('wagstay_unable'), pet('wagstay_unable')] });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'released',
      amount: 0,
    });
    expect(cards.captureHold).not.toHaveBeenCalled();
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
  });

  it('only counts pets still on the booking, and never more than was held', async () => {
    lockedBooking({
      payment: payment({ amount: 200 }),
      pets: [pet('checked_in'), pet(null, { reviewStatus: 'refused' })],
    });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'charged',
      amount: 200,
    });
  });

  it('charges the card at once when no hold was placed in time', async () => {
    lockedBooking({
      payment: payment({ status: 'pending', paymentIntentId: null }),
      pets: [pet('checked_in')],
    });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'charged',
      amount: 230,
    });
    expect(cards.chargeNow).toHaveBeenCalledWith({
      paymentMethodId: 'pm_saved',
      amount: 230,
      reference: 'PB-1A2B3C',
      idempotencyKey: `charge-booking-${BOOKING_ID}`,
    });
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 230,
      paymentIntentId: 'pi_charged',
    });
  });

  it('charges every confirmed pet when a hold released for a later approval was never replaced', async () => {
    // Rex was held for $230; approving Bella after drop-off released that hold, and the 48-hour
    // job holds only before drop-off. The stored $230 is the old hold, not a limit on the charge.
    lockedBooking({
      payment: payment({ status: 'pending', paymentIntentId: 'pi_released', amount: 230 }),
      pets: [pet('checked_in'), pet('checked_in')],
    });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'charged',
      amount: 460,
    });
    expect(cards.chargeNow).toHaveBeenCalledWith(expect.objectContaining({ amount: 460 }));
  });

  it('keeps the arrivals and records the decline when that card is refused', async () => {
    vi.mocked(cards.chargeNow).mockResolvedValue({
      status: 'failed',
      paymentIntentId: 'pi_declined',
      reason: 'declined',
    });
    lockedBooking({
      payment: payment({ status: 'pending', paymentIntentId: null }),
      pets: [pet('no_show')],
    });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'declined',
      amount: 60,
    });
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'failed',
      capturedAmount: null,
      paymentIntentId: 'pi_declined',
    });
  });

  it('does not try a card whose hold already failed', async () => {
    lockedBooking({
      payment: payment({ status: 'failed', paymentIntentId: null }),
      pets: [pet('checked_in')],
    });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'card_failed',
      amount: 230,
    });
    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a pet still unrecorded',
      { pets: [pet('checked_in'), pet(null)] },
      'CHECK_IN_INCOMPLETE',
      409,
    ],
    [
      'a settled booking',
      { payment: payment({ capturedAmount: 460, status: 'succeeded' }), pets: [pet('checked_in')] },
      'BOOKING_SETTLED',
      409,
    ],
    [
      'a booking without a saved card',
      { payment: null, pets: [pet('checked_in')] },
      'BOOKING_NOT_CARD_GUARANTEED',
      409,
    ],
    [
      'a card saved with another processor',
      { payment: payment({ processor: 'fake' }), pets: [pet('checked_in')] },
      'PAYMENTS_NOT_CONFIGURED',
      503,
    ],
  ])('refuses %s without moving money', async (_label, booking, code, statusCode) => {
    lockedBooking(booking);

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).rejects.toMatchObject({
      code,
      statusCode,
    });
    expect(cards.captureHold).not.toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it('reports processor trouble plainly, and saves nothing', async () => {
    vi.mocked(cards.captureHold).mockRejectedValue(new Error('No such payment_intent'));
    lockedBooking({ pets: [pet('checked_in')] });

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).rejects.toMatchObject({
      code: 'CARD_PROCESSOR_ERROR',
      statusCode: 502,
    });
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it('answers 404 for a booking that does not exist', async () => {
    vi.mocked(withLockedBooking).mockResolvedValue(null);

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('cancelling without a fee', () => {
  it('cancels every pet with the reason, releases the hold and removes their tasks', async () => {
    vi.mocked(cancelActivePets).mockResolvedValue(['pet-a', 'pet-b']);
    lockedBooking({ pets: [pet(null), pet(null)] });

    await cancelWithoutFee(BOOKING_ID, 'MetService red warning', { cardProcessor: cards });

    expect(cancelActivePets).toHaveBeenCalledWith(client, BOOKING_ID, 'MetService red warning');
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
    expect(deleteTasksForBookingPet).toHaveBeenCalledTimes(2);
  });

  it('stops a hold from being placed later when there is none yet', async () => {
    vi.mocked(cancelActivePets).mockResolvedValue(['pet-a']);
    lockedBooking({
      payment: payment({ status: 'pending', paymentIntentId: null }),
      pets: [pet(null)],
    });

    await cancelWithoutFee(BOOKING_ID, 'Vet says Biscuit is too unwell', { cardProcessor: cards });

    expect(cards.releaseHold).not.toHaveBeenCalled();
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
  });

  it('is not possible once a pet has arrived', async () => {
    lockedBooking({ pets: [pet('checked_in'), pet(null)] });

    await expect(
      cancelWithoutFee(BOOKING_ID, 'Civil defence emergency', { cardProcessor: cards }),
    ).rejects.toMatchObject({ code: 'BOOKING_ALREADY_ARRIVED', statusCode: 409 });
    expect(cancelActivePets).not.toHaveBeenCalled();
  });
});

describe('the desk for a stay paid at request', () => {
  const paid = (pets: PetAtTheDesk[]): void =>
    lockedBooking({
      paysAtRequest: true,
      payment: payment({ status: 'succeeded', paymentIntentId: 'pi_charged' }),
      pets,
    });

  it('keeps the price of a pet that checked in and half of a no-show, refunding the rest', async () => {
    paid([pet('checked_in'), pet('no_show')]);

    // $230 + half of $230.
    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'charged',
      amount: 345,
    });
    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 115, 'refund-desk-pi_charged');
    expect(cards.captureHold).not.toHaveBeenCalled();
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 345,
    });
  });

  it('refunds everything when Wagstay could not take any pet', async () => {
    paid([pet('wagstay_unable'), pet('wagstay_unable')]);

    await expect(finishCheckIn(BOOKING_ID, { cardProcessor: cards })).resolves.toEqual({
      result: 'released',
      amount: 0,
    });
    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-desk-pi_charged');
  });

  it('refunds everything when Wagstay cancels', async () => {
    vi.mocked(cancelActivePets).mockResolvedValue(['pet-a', 'pet-b']);
    paid([pet(null), pet(null)]);

    await cancelWithoutFee(BOOKING_ID, 'MetService red warning', { cardProcessor: cards });

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-staff-cancel-pi_charged');
    expect(cards.releaseHold).not.toHaveBeenCalled();
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'refunded',
      capturedAmount: 0,
    });
  });
});
