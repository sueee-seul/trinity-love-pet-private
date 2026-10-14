import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findBookingIdOfPet,
  settlePayment,
  withLockedBooking,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { awaitNewHold } from '../repositories/booking.change.repository.js';
import {
  approveBookingPet,
  refuseBookingPet,
  resetBookingPetReview,
} from '../repositories/manager.booking.review.repository.js';
import { insertManagerNotice } from '../repositories/booking.notification.repository.js';
import { assertRoomForStay, fullyBookedError } from '../services/booking.capacity.js';
import { rescheduleAsException } from '../services/booking.guest-reschedule.js';
import {
  approveBooking,
  refuseBooking,
  rescheduleForException,
  undoBookingReview,
} from '../services/manager.booking.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import { chargeWhenDecided, refundChargedPet } from '../services/booking.settlement.js';
import {
  chargedBooking,
  guaranteePayment,
  LOCKED_BOOKING_ID,
  lockedBooking,
  lockedPet,
} from './support/lockedBookingFixtures.js';
import {
  createTasksForBookingPet,
  deleteTasksForBookingPet,
} from '../services/task.fromBooking.service.js';

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  findBookingIdOfPet: vi.fn(),
  withLockedBooking: vi.fn(),
  settlePayment: vi.fn(),
}));

vi.mock('../repositories/booking.change.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.change.repository.js')>()),
  awaitNewHold: vi.fn(async () => undefined),
}));

vi.mock('../repositories/manager.booking.repository.js', () => ({ listAllBookings: vi.fn() }));

vi.mock('../repositories/manager.booking.review.repository.js', () => ({
  approveBookingPet: vi.fn(async () => true),
  refuseBookingPet: vi.fn(async () => true),
  resetBookingPetReview: vi.fn(async () => true),
}));

vi.mock('../services/booking.capacity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/booking.capacity.js')>()),
  assertRoomForStay: vi.fn(async () => undefined),
}));

vi.mock('../services/booking.guest-reschedule.js', () => ({
  rescheduleAsException: vi.fn(async () => ({ usesFreeReschedule: false, held: false })),
}));

vi.mock('../repositories/booking.notification.repository.js', () => ({
  insertManagerFlag: vi.fn(),
  insertManagerNotice: vi.fn(async () => undefined),
  insertParentNoticeWithinTransaction: vi.fn(),
}));

vi.mock('../services/booking.settlement.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/booking.settlement.js')>()),
  chargeWhenDecided: vi.fn(async () => 'charged'),
  refundChargedPet: vi.fn(async () => undefined),
}));

vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(async () => undefined),
  deleteTasksForBookingPet: vi.fn(async () => undefined),
}));

const BOOKING_ID = LOCKED_BOOKING_ID;
const MANAGER_ID = 'manager-1';
const client = {} as PoolClient;

const cards = {
  name: 'stripe',
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
} as unknown as CardProcessor;

const PET_A: PetAtTheDesk = lockedPet();
const PET_B: PetAtTheDesk = lockedPet({ bookingPetsUuid: 'pet-b' });

const twoPets = lockedBooking;

const lock = (booking: LockedBooking): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) => work(booking, client));
};

/** The hold was released and the 48-hour job will hold the new total of the approved pets. */
const expectHoldRenewedForNewTotal = (): void => {
  expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
  expect(awaitNewHold).toHaveBeenCalledWith(client, BOOKING_ID, 'payment-1');
  expect(settlePayment).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findBookingIdOfPet).mockResolvedValue(BOOKING_ID);
});

describe('approving a pet of a request', () => {
  it('approves it with its notice in the booking transaction and makes its care plan', async () => {
    lock(
      twoPets({
        pets: [{ ...PET_A, reviewStatus: 'pending' }, PET_B],
        payment: guaranteePayment({ status: 'pending', paymentIntentId: null }),
      }),
    );

    await approveBooking('pet-a', MANAGER_ID, { cardProcessor: cards });

    expect(approveBookingPet).toHaveBeenCalledWith(
      'pet-a',
      MANAGER_ID,
      expect.any(Function),
      client,
    );
    // Nothing is held yet: the 48-hour job holds the approved pets when it runs.
    expect(cards.releaseHold).not.toHaveBeenCalled();
    expect(awaitNewHold).not.toHaveBeenCalled();
    expect(createTasksForBookingPet).toHaveBeenCalledWith('pet-a');
  });

  it('releases an earlier hold so the job holds the larger total', async () => {
    lock(twoPets({ pets: [{ ...PET_A, reviewStatus: 'pending' }, PET_B] }));

    await approveBooking('pet-a', MANAGER_ID, { cardProcessor: cards });

    expectHoldRenewedForNewTotal();
  });

  it('changes nothing about the hold when the pet was already approved', async () => {
    lock(twoPets());

    await approveBooking('pet-a', MANAGER_ID, { cardProcessor: cards });

    expect(cards.releaseHold).not.toHaveBeenCalled();
  });

  it('is refused once the booking is settled', async () => {
    lock(twoPets({ payment: guaranteePayment({ status: 'succeeded', capturedAmount: 230 }) }));

    await expect(
      approveBooking('pet-a', MANAGER_ID, { cardProcessor: cards }),
    ).rejects.toMatchObject({
      code: 'BOOKING_SETTLED',
      statusCode: 409,
    });
    expect(approveBookingPet).not.toHaveBeenCalled();
    expect(createTasksForBookingPet).not.toHaveBeenCalled();
  });
});

describe('refusing a pet (Wagstay cannot take it)', () => {
  it('keeps the hold when the refused pet was only a request', async () => {
    lock(twoPets({ pets: [{ ...PET_A, reviewStatus: 'pending' }, PET_B] }));

    await refuseBooking('pet-a', MANAGER_ID, 'No room for a large dog', { cardProcessor: cards });

    expect(refuseBookingPet).toHaveBeenCalledWith(
      'pet-a',
      MANAGER_ID,
      'No room for a large dog',
      expect.any(Function),
      client,
    );
    expect(cards.releaseHold).not.toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it('releases the hold so the job holds the smaller total when an approved pet is refused', async () => {
    lock(twoPets());

    await refuseBooking('pet-a', MANAGER_ID, 'No room for a large dog', { cardProcessor: cards });

    expectHoldRenewedForNewTotal();
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('pet-a');
  });

  it('releases the hold in full with the last pet, in the same transaction', async () => {
    lock(twoPets({ pets: [PET_A, { ...PET_B, reviewStatus: 'refused' }] }));

    await refuseBooking('pet-a', MANAGER_ID, 'Kennel flooded', { cardProcessor: cards });

    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
  });

  it('points to the desk for a pet that has already arrived', async () => {
    lock(twoPets({ pets: [{ ...PET_A, outcome: 'checked_in' }, PET_B] }));

    await expect(
      refuseBooking('pet-a', MANAGER_ID, 'Too anxious', { cardProcessor: cards }),
    ).rejects.toMatchObject({
      code: 'BOOKING_ALREADY_ARRIVED',
      statusCode: 409,
    });
    expect(refuseBookingPet).not.toHaveBeenCalled();
  });

  it('still refuses a classic booking, which has no card to release', async () => {
    lock(twoPets({ payment: null, pets: [PET_A] }));

    await refuseBooking('pet-a', MANAGER_ID, 'Fully booked', { cardProcessor: cards });

    expect(refuseBookingPet).toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });
});

describe('undoing a decision', () => {
  it('puts a refusal back to pending while nothing was settled', async () => {
    lock(twoPets({ pets: [{ ...PET_A, reviewStatus: 'refused' }, PET_B] }));

    await undoBookingReview('pet-a', { cardProcessor: cards });

    expect(resetBookingPetReview).toHaveBeenCalledWith('pet-a', expect.any(Function), client);
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('pet-a');
    expect(cards.releaseHold).not.toHaveBeenCalled();
  });

  it('checks the nights are free again before taking a refused pet back', async () => {
    lock(twoPets({ pets: [{ ...PET_A, reviewStatus: 'refused' }, PET_B] }));
    vi.mocked(assertRoomForStay).mockRejectedValueOnce(fullyBookedError(['2026-10-12']));

    await expect(undoBookingReview('pet-a', { cardProcessor: cards })).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(assertRoomForStay).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ petCount: 1 }),
    );
    expect(resetBookingPetReview).not.toHaveBeenCalled();
    expect(deleteTasksForBookingPet).not.toHaveBeenCalled();
  });

  it('does not recount a pet that already holds its place', async () => {
    lock(twoPets({ pets: [{ ...PET_A, reviewStatus: 'approved' }, PET_B] }));

    await undoBookingReview('pet-a', { cardProcessor: cards });

    expect(assertRoomForStay).not.toHaveBeenCalled();
  });

  it('releases the hold when an approved pet goes back to review', async () => {
    lock(twoPets());

    await undoBookingReview('pet-a', { cardProcessor: cards });

    expectHoldRenewedForNewTotal();
  });

  it.each([
    [
      'a settled booking',
      twoPets({ payment: guaranteePayment({ status: 'succeeded', capturedAmount: 230 }) }),
      'BOOKING_SETTLED',
    ],
    [
      'a pet that arrived',
      twoPets({ pets: [{ ...PET_A, outcome: 'checked_in' as const }, PET_B] }),
      'BOOKING_ALREADY_ARRIVED',
    ],
  ])('is refused for %s', async (_label, booking, code) => {
    lock(booking);

    await expect(undoBookingReview('pet-a', { cardProcessor: cards })).rejects.toMatchObject({
      code,
      statusCode: 409,
    });
    expect(resetBookingPetReview).not.toHaveBeenCalled();
  });
});

describe('moving a stay without a charge', () => {
  const dates = { startDate: '2026-12-19', endDate: '2026-12-22' };

  it('moves it without using the free change, and keeps the reason for every manager', async () => {
    await rescheduleForException(BOOKING_ID, dates, 'MetService red warning', {
      cardProcessor: cards,
    });

    expect(rescheduleAsException).toHaveBeenCalledWith(BOOKING_ID, dates, { cardProcessor: cards });
    expect(insertManagerNotice).toHaveBeenCalledWith(expect.anything(), {
      bookingId: BOOKING_ID,
      setting: 'booking_moved_by_staff',
      summary:
        'PB-1A2B3C moved to Sat 19 Dec (pick-up Tue 22 Dec) without a charge. Reason: MetService red warning',
    });
  });

  it('keeps the move when the notice cannot be written', async () => {
    vi.mocked(insertManagerNotice).mockRejectedValueOnce(new Error('connection lost'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      rescheduleForException(BOOKING_ID, dates, 'Vet says Biscuit is unwell', {
        cardProcessor: cards,
      }),
    ).resolves.toMatchObject({ usesFreeReschedule: false });
  });
});

describe('decisions on a booking paid at request', () => {
  const heldRequest = (pets: PetAtTheDesk[]): LockedBooking =>
    lockedBooking({ paysAtRequest: true, pets });

  it('charges the confirmed pets once the last waiting pet is approved', async () => {
    const booking = heldRequest([PET_A, { ...PET_B, reviewStatus: 'pending' }]);
    lock(booking);

    await approveBooking('pet-b', MANAGER_ID, { cardProcessor: cards });

    expect(chargeWhenDecided).toHaveBeenCalledWith(
      booking,
      [PET_A, { ...PET_B, reviewStatus: 'approved' }],
      client,
      cards,
    );
    // The 48-hour job is not involved: the hold is not renewed.
    expect(awaitNewHold).not.toHaveBeenCalled();
  });

  it('settles the hold with the refused pet left out', async () => {
    const booking = heldRequest([PET_A, { ...PET_B, reviewStatus: 'pending' }]);
    lock(booking);

    await refuseBooking('pet-b', MANAGER_ID, 'No room', { cardProcessor: cards });

    expect(chargeWhenDecided).toHaveBeenCalledWith(
      booking,
      [PET_A, { ...PET_B, reviewStatus: 'refused' }],
      client,
      cards,
    );
  });

  it('gives a charged pet its price back when it is refused later', async () => {
    const booking = chargedBooking();
    lock(booking);

    await refuseBooking('pet-b', MANAGER_ID, 'Kennel flooded', { cardProcessor: cards });

    expect(refundChargedPet).toHaveBeenCalledWith(booking.payment, PET_B, true, client, cards);
    expect(chargeWhenDecided).not.toHaveBeenCalled();
  });

  it('will not send a charged stay back to review', async () => {
    lock(chargedBooking());

    await expect(undoBookingReview('pet-a', { cardProcessor: cards })).rejects.toMatchObject({
      code: 'BOOKING_ALREADY_PAID',
      statusCode: 409,
    });
  });

  it('lets a pet wait again while the hold stands, moving no money', async () => {
    lock(
      heldRequest([
        { ...PET_A, reviewStatus: 'refused' },
        { ...PET_B, reviewStatus: 'pending' },
      ]),
    );

    await undoBookingReview('pet-a', { cardProcessor: cards });

    expect(cards.releaseHold).not.toHaveBeenCalled();
    expect(chargeWhenDecided).not.toHaveBeenCalled();
  });
});
