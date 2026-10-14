import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lockBookingCapacity } from '../repositories/booking.capacity.repository.js';
import {
  insertBookingCharge,
  listChargesForBooking,
  movePickUp,
} from '../repositories/booking.charges.repository.js';
import {
  withLockedBooking,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { findFullNights } from '../services/booking.capacity.js';
import { extendStay, previewExtension } from '../services/booking.guest-extend.js';
import { notifyStayExtended } from '../services/booking.in-stay.notifications.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import { createTasksForBookingPet } from '../services/task.fromBooking.service.js';
import { LOCKED_BOOKING_ID, lockedPet, OWNER_ID } from './support/lockedBookingFixtures.js';
import { DURING_STAY, ledgerCharge, stayingBooking } from './support/stayingBookingFixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  withLockedBooking: vi.fn(),
}));

vi.mock('../repositories/booking.charges.repository.js', () => ({
  DESK_PROCESSOR: 'desk',
  listChargesForBooking: vi.fn(async () => []),
  insertBookingCharge: vi.fn(async () => 'charge-new'),
  movePickUp: vi.fn(async () => undefined),
  readPetNamesForBooking: vi.fn(
    async () =>
      new Map([
        ['pet-a', 'Biscuit'],
        ['pet-b', 'Mochi'],
      ]),
  ),
}));

vi.mock('../repositories/booking.capacity.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.capacity.repository.js')>()),
  lockBookingCapacity: vi.fn(async () => undefined),
}));

vi.mock('../services/booking.capacity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/booking.capacity.js')>()),
  findFullNights: vi.fn(async () => []),
}));

vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(async () => ({ tasks: [] })),
}));

vi.mock('../services/booking.in-stay.notifications.js', () => ({
  notifyStayExtended: vi.fn(async () => undefined),
}));

const client = {} as PoolClient;

const lock = (booking: LockedBooking): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) => work(booking, client));
};

const processor = (): CardProcessor => ({
  name: 'stripe',
  publishableKey: 'pk_test_example',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn(),
  captureHold: vi.fn(async () => undefined),
  releaseHold: vi.fn(async () => undefined),
  refund: vi.fn(async () => undefined),
  chargeNow: vi.fn<CardProcessor['chargeNow']>(async () => ({
    status: 'succeeded',
    paymentIntentId: 'pi_extension',
  })),
});

let cards: CardProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  cards = processor();
  vi.mocked(listChargesForBooking).mockResolvedValue([]);
  vi.mocked(findFullNights).mockResolvedValue([]);
});

describe('pricing an extension', () => {
  it("prices the added nights at each pet's booked nightly rate, and checks only those nights", async () => {
    lock(stayingBooking());

    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-17', { now: DURING_STAY }),
    ).resolves.toEqual({
      currentEndDate: '2026-12-15',
      newEndDate: '2026-12-17',
      addedNights: 2,
      pets: [
        { bookingPetId: 'pet-a', petName: 'Biscuit', nightlyRate: 60, amount: 120 },
        { bookingPetId: 'pet-b', petName: 'Mochi', nightlyRate: 60, amount: 120 },
      ],
      amount: 240,
      settlement: 'card',
    });
    // The nights the stay did not have yet, with the booking's own pets left out of the count.
    expect(findFullNights).toHaveBeenCalledWith(
      {
        startDate: '2026-12-15',
        endDate: '2026-12-17',
        petCount: 2,
        excludeBookingId: LOCKED_BOOKING_ID,
      },
      undefined,
    );
    expect(lockBookingCapacity).not.toHaveBeenCalled();
  });

  it.each([
    ['a date that is not later', '2026-12-15', 'EXTENSION_DATES_INVALID'],
    ['a stay longer than 60 nights', '2027-03-01', 'EXTENSION_DATES_INVALID'],
  ])('refuses %s', async (_label, endDate, code) => {
    lock(stayingBooking());
    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, endDate, { now: DURING_STAY }),
    ).rejects.toMatchObject({ statusCode: 422, code });
  });

  it('is only for a stay under way: every pet checked in and not yet picked up', async () => {
    lock(
      stayingBooking({
        pets: [lockedPet({ outcome: 'checked_in' }), lockedPet({ bookingPetsUuid: 'pet-b' })],
      }),
    );
    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-16', { now: DURING_STAY }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAY_NOT_UNDER_WAY' });

    lock(stayingBooking());
    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-16', {
        now: new Date('2026-12-15T04:00:00Z'),
      }),
    ).rejects.toMatchObject({ code: 'STAY_NOT_UNDER_WAY' });

    lock(stayingBooking({ ownerId: 'someone-else' }));
    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-16', { now: DURING_STAY }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('names the full nights when there is no room', async () => {
    lock(stayingBooking());
    vi.mocked(findFullNights).mockResolvedValueOnce(['2026-12-16']);
    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-17', { now: DURING_STAY }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-12-16' }] });
  });
});

describe('extending the stay', () => {
  it('charges the saved card once, records the charge, moves every pick-up and adds the new days', async () => {
    lock(stayingBooking());

    await expect(
      extendStay(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { endDate: '2026-12-17', expectedAmount: 240 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).resolves.toMatchObject({
      amount: 240,
      addedNights: 2,
      chargeId: 'charge-new',
      settlement: 'card',
    });

    expect(lockBookingCapacity).toHaveBeenCalledWith(client);
    expect(cards.chargeNow).toHaveBeenCalledWith({
      paymentMethodId: 'pm_saved',
      amount: 240,
      reference: expect.stringMatching(/^PB-/),
      idempotencyKey: `extend-${LOCKED_BOOKING_ID}-2026-12-17-1`,
    });
    expect(insertBookingCharge).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        kind: 'extension',
        amount: 240,
        paymentIntentId: 'pi_extension',
        idempotencyKey: `extend-${LOCKED_BOOKING_ID}-2026-12-17-1`,
      }),
    );
    // Each pet keeps its 16:00 Auckland pick-up time on the new day.
    expect(movePickUp).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      ['pet-a'],
      new Date('2026-12-17T03:00:00Z'),
    );
    expect(movePickUp).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      ['pet-b'],
      new Date('2026-12-17T03:00:00Z'),
    );
    expect(createTasksForBookingPet).toHaveBeenCalledTimes(2);
    expect(notifyStayExtended).toHaveBeenCalledWith(
      LOCKED_BOOKING_ID,
      expect.objectContaining({ amount: 240 }),
    );
  });

  it('without a saved card, extends and records the nights as owed at check-out', async () => {
    lock(stayingBooking({ payment: null }));

    await expect(
      previewExtension(OWNER_ID, LOCKED_BOOKING_ID, '2026-12-17', { now: DURING_STAY }),
    ).resolves.toMatchObject({ amount: 240, settlement: 'desk' });

    await expect(
      extendStay(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { endDate: '2026-12-17', expectedAmount: 240 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).resolves.toMatchObject({ amount: 240, chargeId: 'charge-new', settlement: 'desk' });

    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(insertBookingCharge).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        kind: 'extension',
        amount: 240,
        processor: 'desk',
        paymentIntentId: null,
      }),
    );
    expect(movePickUp).toHaveBeenCalledTimes(2);
    expect(notifyStayExtended).toHaveBeenCalledWith(
      LOCKED_BOOKING_ID,
      expect.objectContaining({ settlement: 'desk' }),
    );
  });

  it('uses the next key when the same extension was charged before, so a retry never charges twice', async () => {
    lock(stayingBooking());
    vi.mocked(listChargesForBooking).mockResolvedValueOnce([
      ledgerCharge({ description: 'Stay extended to 2026-12-17: 2 nights at the booked rates' }),
    ]);

    await extendStay(
      OWNER_ID,
      LOCKED_BOOKING_ID,
      { endDate: '2026-12-17' },
      { now: DURING_STAY, cardProcessor: cards },
    );

    expect(cards.chargeNow).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `extend-${LOCKED_BOOKING_ID}-2026-12-17-2` }),
    );
  });

  it('moves no money and no date when the price differs from the one the parent saw', async () => {
    lock(stayingBooking());

    await expect(
      extendStay(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { endDate: '2026-12-17', expectedAmount: 120 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).rejects.toMatchObject({ code: 'EXTENSION_PRICE_CHANGED', details: [{ amount: 240 }] });
    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(movePickUp).not.toHaveBeenCalled();
  });

  it('changes nothing when the card is declined', async () => {
    lock(stayingBooking());
    vi.mocked(cards.chargeNow).mockResolvedValueOnce({
      status: 'failed',
      paymentIntentId: null,
      reason: 'declined',
    });

    await expect(
      extendStay(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { endDate: '2026-12-17' },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).rejects.toMatchObject({ statusCode: 402, code: 'CARD_DECLINED' });
    expect(insertBookingCharge).not.toHaveBeenCalled();
    expect(movePickUp).not.toHaveBeenCalled();
    expect(createTasksForBookingPet).not.toHaveBeenCalled();
  });
});
