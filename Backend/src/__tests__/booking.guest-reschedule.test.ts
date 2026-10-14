import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lockBookingCapacity } from '../repositories/booking.capacity.repository.js';
import { moveStay, renewGuarantee } from '../repositories/booking.change.repository.js';
import {
  recordCharge,
  withLockedBooking,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { findFullNights } from '../services/booking.capacity.js';
import { notifyBookingDatesChanged } from '../services/booking.notifications.js';
import {
  createTasksForBookingPet,
  deleteTasksForBookingPet,
} from '../services/task.fromBooking.service.js';
import {
  previewReschedule,
  rescheduleAsException,
  rescheduleByGuest,
} from '../services/booking.guest-reschedule.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import {
  guaranteePayment,
  LOCKED_BOOKING_ID,
  chargedBooking,
  lockedBooking,
  lockedPet,
  OWNER_ID,
} from './support/lockedBookingFixtures.js';

vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(async () => ({ tasks: [] })),
  deleteTasksForBookingPet: vi.fn(async () => undefined),
}));

vi.mock('../services/booking.notifications.js', () => ({
  notifyBookingDatesChanged: vi.fn(async () => undefined),
}));

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  withLockedBooking: vi.fn(),
  recordCharge: vi.fn(async () => undefined),
  settlePayment: vi.fn(async () => undefined),
}));

vi.mock('../repositories/booking.change.repository.js', () => ({
  moveStay: vi.fn(async () => undefined),
  renewGuarantee: vi.fn(async () => undefined),
}));

vi.mock('../repositories/booking.capacity.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.capacity.repository.js')>()),
  lockBookingCapacity: vi.fn(async () => undefined),
}));

vi.mock('../services/booking.capacity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/booking.capacity.js')>()),
  findFullNights: vi.fn(async () => []),
}));

const client = {} as PoolClient;
/** Mon 30 Nov 2026, 09:00 in Auckland: 12 days before the booked drop-off. */
const NOW = new Date('2026-11-29T20:00:00Z');
/** Three nights moving to Sat 19 Dec: drop-off still 10:30, pick-up still 16:00. */
const NEW_DATES = { startDate: '2026-12-19', endDate: '2026-12-22' };
const NEW_DROP_OFF = new Date('2026-12-18T21:30:00Z');

const lock = (booking: LockedBooking): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) => work(booking, client));
};

const processor = (): CardProcessor => ({
  name: 'stripe',
  publishableKey: 'pk_test_example',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn<CardProcessor['placeHold']>(async () => ({
    status: 'succeeded',
    paymentIntentId: 'pi_new',
  })),
  captureHold: vi.fn(),
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
  refund: vi.fn<CardProcessor['refund']>(async () => undefined),
  chargeNow: vi.fn(),
});

let cards: CardProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  cards = processor();
  lock(lockedBooking());
});

describe('changing the dates of a stay', () => {
  it('prices the new nights at the booked rates and says when the card is held', async () => {
    await expect(
      previewReschedule(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW }),
    ).resolves.toEqual({
      ...NEW_DATES,
      nights: 3,
      // Two pets, each 3 nights x $60 + $50.
      total: 460,
      usesFreeReschedule: true,
      holdAt: new Date(NEW_DROP_OFF.getTime() - 48 * 3_600_000).toISOString(),
      // An older booking: the 48-hour job holds the new price later.
      paysNow: false,
    });
    expect(findFullNights).toHaveBeenCalledWith(
      { ...NEW_DATES, petCount: 2, excludeBookingId: LOCKED_BOOKING_ID },
      undefined,
    );
  });

  it('moves nothing when the total differs from the one the guest saw', async () => {
    const longer = { startDate: '2026-12-19', endDate: '2026-12-23', expectedTotal: 460 };

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, longer, { now: NOW, cardProcessor: cards }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESCHEDULE_PRICE_CHANGED',
      details: [{ amount: 580 }],
    });

    expect(moveStay).not.toHaveBeenCalled();
    expect(deleteTasksForBookingPet).not.toHaveBeenCalled();
    expect(cards.releaseHold).not.toHaveBeenCalled();
  });

  it('moves every pet, keeps their times of day, and releases the old hold', async () => {
    const longer = { startDate: '2026-12-19', endDate: '2026-12-23', expectedTotal: 580 };

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, longer, { now: NOW, cardProcessor: cards }),
    ).resolves.toMatchObject({ nights: 4, total: 580, held: false, usesFreeReschedule: true });

    expect(lockBookingCapacity).toHaveBeenCalledWith(client);
    expect(moveStay).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      [
        {
          bookingPetsUuid: 'pet-a',
          dropOffAt: NEW_DROP_OFF,
          pickUpAt: new Date('2026-12-23T03:00:00Z'),
        },
        {
          bookingPetsUuid: 'pet-b',
          dropOffAt: NEW_DROP_OFF,
          pickUpAt: new Date('2026-12-23T03:00:00Z'),
        },
      ],
      true,
      true,
    );
    expect(renewGuarantee).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'pending',
      amount: 580,
      paymentIntentId: 'pi_held',
    });
    expect(cards.placeHold).not.toHaveBeenCalled();
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
  });

  it('returns even imminent dates to review without a new hold', async () => {
    await expect(
      rescheduleByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { startDate: '2026-12-01', endDate: '2026-12-04' },
        { now: NOW, cardProcessor: cards },
      ),
    ).resolves.toMatchObject({ held: false });
    expect(cards.placeHold).not.toHaveBeenCalled();
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(renewGuarantee).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'pending',
      amount: 460,
      paymentIntentId: 'pi_held',
    });
  });

  it('names the full nights and moves nothing', async () => {
    vi.mocked(findFullNights).mockResolvedValueOnce(['2026-12-20']);

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW, cardProcessor: cards }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONCIERGE_FULLY_BOOKED' });
    expect(moveStay).not.toHaveBeenCalled();
  });

  it('allows one free change; staff can still move it without using one', async () => {
    lock(lockedBooking({ rescheduleCount: 1 }));

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW, cardProcessor: cards }),
    ).rejects.toMatchObject({ code: 'RESCHEDULE_USED' });

    await expect(
      rescheduleAsException(LOCKED_BOOKING_ID, NEW_DATES, { now: NOW, cardProcessor: cards }),
    ).resolves.toMatchObject({ usesFreeReschedule: false });
    expect(moveStay).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      expect.any(Array),
      false,
      false,
    );
  });

  it('tells the managers and the parent once the guest has moved the stay back to review', async () => {
    await rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, {
      now: NOW,
      cardProcessor: cards,
    });

    expect(notifyBookingDatesChanged).toHaveBeenCalledWith(LOCKED_BOOKING_ID);
    // Approval made the care plan for the old dates; the new dates wait for a new approval.
    // The plan is found by the stay's dates, so it goes in the move's transaction, before the
    // new dates are written (otherwise the delete looks in the new window and finds nothing).
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('pet-a', client);
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('pet-b', client);
    expect(createTasksForBookingPet).not.toHaveBeenCalled();
    const moved = vi.mocked(moveStay).mock.invocationCallOrder[0] ?? 0;
    const cleared = vi.mocked(deleteTasksForBookingPet).mock.invocationCallOrder.at(-1) ?? 0;
    expect(cleared).toBeLessThan(moved);
    const told = vi.mocked(notifyBookingDatesChanged).mock.invocationCallOrder[0] ?? 0;
    expect(told).toBeGreaterThan(moved);
  });

  it('tells nobody when the new dates cannot be booked', async () => {
    vi.mocked(findFullNights).mockResolvedValueOnce(['2026-12-20']);

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW, cardProcessor: cards }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_FULLY_BOOKED' });
    expect(notifyBookingDatesChanged).not.toHaveBeenCalled();
  });

  it('keeps a stay staff move for an emergency approved, with a care plan for the new dates', async () => {
    lock(
      lockedBooking({
        pets: [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'pending' })],
      }),
    );

    await expect(
      rescheduleAsException(LOCKED_BOOKING_ID, NEW_DATES, { now: NOW, cardProcessor: cards }),
    ).resolves.toMatchObject({ held: false, usesFreeReschedule: false });

    // Approvals stay; the old hold is released for the 48-hour job to hold the new dates.
    expect(moveStay).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      expect.any(Array),
      false,
      false,
    );
    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(renewGuarantee).toHaveBeenCalledWith(
      client,
      'payment-1',
      expect.objectContaining({ status: 'pending', paymentIntentId: 'pi_held' }),
    );
    // Only the approved pet has a care plan, now for the new dates.
    expect(deleteTasksForBookingPet).toHaveBeenCalledWith('pet-a', client);
    expect(createTasksForBookingPet).toHaveBeenCalledWith('pet-a');
    expect(createTasksForBookingPet).not.toHaveBeenCalledWith('pet-b');
    expect(notifyBookingDatesChanged).not.toHaveBeenCalled();
  });

  it.each([
    ['a pick-up before the drop-off', { startDate: '2026-12-19', endDate: '2026-12-19' }],
    ['a drop-off in the past', { startDate: '2026-11-20', endDate: '2026-11-23' }],
    ['more than 60 nights', { startDate: '2026-12-19', endDate: '2027-03-01' }],
  ])('refuses %s', async (_label, dates) => {
    await expect(
      previewReschedule(OWNER_ID, LOCKED_BOOKING_ID, dates, { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'RESCHEDULE_DATES_INVALID' });
  });

  it('sends a guest whose card was already refused to the team', async () => {
    lock(lockedBooking({ payment: guaranteePayment({ status: 'failed', paymentIntentId: null }) }));

    await expect(
      previewReschedule(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW }),
    ).rejects.toMatchObject({ code: 'BOOKING_CARD_FAILED' });
  });

  it("answers 404 for another owner's booking", async () => {
    lock(lockedBooking({ ownerId: 'someone-else' }));

    await expect(
      previewReschedule(OWNER_ID, LOCKED_BOOKING_ID, NEW_DATES, { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('changing the dates of a stay paid at request', () => {
  const longer = { startDate: '2026-12-19', endDate: '2026-12-23' };

  it('holds the new price first, charges it, then refunds the old payment, keeping decisions', async () => {
    lock(chargedBooking());
    cards.captureHold = vi.fn<CardProcessor['captureHold']>(async () => undefined);

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, longer, { now: NOW, cardProcessor: cards }),
    ).resolves.toMatchObject({ total: 580, held: true, paysNow: true });

    expect(cards.placeHold).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 580,
        idempotencyKey: `reschedule-hold-${LOCKED_BOOKING_ID}-pi_charged`,
      }),
    );
    // Decisions stand: nobody goes back to review.
    expect(moveStay).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      expect.any(Array),
      true,
      false,
    );
    expect(renewGuarantee).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'authorized',
      amount: 580,
      paymentIntentId: 'pi_new',
    });
    // Both pets are confirmed, so the new price is charged at once: 2 x (4 nights x $60 + $50).
    expect(cards.captureHold).toHaveBeenCalledWith('pi_new', 580, 'capture-confirmed-pi_new');
    expect(recordCharge).toHaveBeenCalledWith(client, 'payment-1', 580);
    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-reschedule-pi_charged');
    expect(notifyBookingDatesChanged).not.toHaveBeenCalled();
  });

  it('lets a guest under the current terms change the dates again, and counts each change', async () => {
    lock(chargedBooking({ termsVersion: 'concierge-terms-2026-10-06', rescheduleCount: 2 }));
    cards.captureHold = vi.fn<CardProcessor['captureHold']>(async () => undefined);

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, longer, { now: NOW, cardProcessor: cards }),
    ).resolves.toMatchObject({ total: 580, usesFreeReschedule: false });
    expect(moveStay).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      expect.any(Array),
      true,
      false,
    );
  });

  it('changes nothing when the card is declined for the new price', async () => {
    lock(chargedBooking());
    vi.mocked(cards.placeHold).mockResolvedValueOnce({
      status: 'failed',
      paymentIntentId: null,
      reason: 'declined',
    });

    await expect(
      rescheduleByGuest(OWNER_ID, LOCKED_BOOKING_ID, longer, { now: NOW, cardProcessor: cards }),
    ).rejects.toMatchObject({ code: 'CARD_DECLINED', statusCode: 402 });
    expect(moveStay).not.toHaveBeenCalled();
    expect(cards.refund).not.toHaveBeenCalled();
  });
});
