import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertBookingCharge,
  listChargesForBooking,
} from '../repositories/booking.charges.repository.js';
import {
  withLockedBooking,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { insertAddOnTask } from '../repositories/booking.in-stay.tasks.repository.js';
import { listServices } from '../repositories/petparent.booking.repository.js';
import { bookAddOn, listAddOns } from '../services/booking.guest-addon.js';
import { notifyAddOnBooked } from '../services/booking.in-stay.notifications.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import { LOCKED_BOOKING_ID, OWNER_ID } from './support/lockedBookingFixtures.js';
import { DURING_STAY, stayingBooking } from './support/stayingBookingFixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  withLockedBooking: vi.fn(),
}));

vi.mock('../repositories/booking.charges.repository.js', () => ({
  DESK_PROCESSOR: 'desk',
  listChargesForBooking: vi.fn(async () => []),
  insertBookingCharge: vi.fn(async () => 'charge-addon'),
  readPetNamesForBooking: vi.fn(async () => new Map([['pet-a', 'Biscuit']])),
}));

vi.mock('../repositories/booking.in-stay.tasks.repository.js', () => ({
  insertAddOnTask: vi.fn(async () => 'task-1'),
}));

vi.mock('../repositories/petparent.booking.repository.js', () => ({
  listServices: vi.fn(async () => [
    {
      id: 'svc-room',
      name: 'Standard room',
      category: 'boarding_rate',
      price: 52,
      priceUnit: 'per night',
      compulsory: false,
    },
    {
      id: 'svc-walk',
      name: 'Outdoor Walk',
      category: 'addon',
      price: 15,
      priceUnit: 'per day',
      compulsory: false,
    },
    {
      id: 'svc-groom',
      name: 'Grooming: bath and brush',
      category: 'addon',
      price: 55,
      priceUnit: 'per stay',
      compulsory: false,
    },
  ]),
}));

vi.mock('../services/booking.in-stay.notifications.js', () => ({
  notifyAddOnBooked: vi.fn(async (_bookingId: string, result: unknown) => ({
    ...(result as object),
    petName: 'Biscuit',
  })),
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
    paymentIntentId: 'pi_addon',
  })),
});

let cards: CardProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  cards = processor();
  vi.mocked(listChargesForBooking).mockResolvedValue([]);
});

describe('the add-ons a parent can book', () => {
  it("lists the add-on services at today's prices and the days left in the stay", async () => {
    lock(stayingBooking());

    await expect(listAddOns(OWNER_ID, LOCKED_BOOKING_ID, { now: DURING_STAY })).resolves.toEqual({
      offers: [
        {
          serviceId: 'svc-walk',
          name: 'Outdoor Walk',
          description: null,
          price: 15,
          priceUnit: 'per day',
        },
        {
          serviceId: 'svc-groom',
          name: 'Grooming: bath and brush',
          description: null,
          price: 55,
          priceUnit: 'per stay',
        },
      ],
      // Today (Sun 13 Dec) up to the night before the Tue 15 Dec check-out.
      days: ['2026-12-13', '2026-12-14'],
      settlement: 'card',
    });
    expect(listServices).toHaveBeenCalled();
  });

  it('says the add-ons go on the bill for check-out when the booking has no saved card', async () => {
    lock(stayingBooking({ payment: null }));

    await expect(
      listAddOns(OWNER_ID, LOCKED_BOOKING_ID, { now: DURING_STAY }),
    ).resolves.toMatchObject({ settlement: 'desk' });
  });
});

describe('booking an add-on', () => {
  it('charges the saved card for the quantity, records it and puts a task on that day', async () => {
    lock(stayingBooking());

    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { serviceId: 'svc-walk', date: '2026-12-14', quantity: 2, expectedAmount: 30 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).resolves.toEqual({
      chargeId: 'charge-addon',
      bookingPetId: 'pet-a',
      petName: 'Biscuit',
      serviceName: 'Outdoor Walk',
      date: '2026-12-14',
      quantity: 2,
      amount: 30,
      taskId: 'task-1',
      settlement: 'card',
    });

    expect(cards.chargeNow).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30, idempotencyKey: 'addon-pet-a-svc-walk-2026-12-14-1' }),
    );
    expect(insertBookingCharge).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        kind: 'add_on',
        bookingPetsUuid: 'pet-a',
        servicesUuid: 'svc-walk',
        serviceDate: '2026-12-14',
        quantity: 2,
        amount: 30,
      }),
    );
    expect(insertAddOnTask).toHaveBeenCalledWith(client, {
      bookingPetsUuid: 'pet-a',
      title: 'Outdoor Walk (add-on)',
      day: '2026-12-14',
      description: expect.stringContaining('2 x Outdoor Walk'),
      priority: 'mid',
    });
    expect(notifyAddOnBooked).toHaveBeenCalled();
  });

  it('without a saved card, books it and records the amount as owed at check-out', async () => {
    lock(stayingBooking({ payment: null }));

    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { serviceId: 'svc-walk', date: '2026-12-14', quantity: 1, expectedAmount: 15 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).resolves.toMatchObject({ chargeId: 'charge-addon', amount: 15, settlement: 'desk' });

    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(insertBookingCharge).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        kind: 'add_on',
        amount: 15,
        processor: 'desk',
        paymentIntentId: null,
        idempotencyKey: 'addon-pet-a-svc-walk-2026-12-14-1',
      }),
    );
    expect(insertAddOnTask).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ description: expect.stringContaining('to pay at check-out') }),
    );
  });

  it('books a per-stay service once, flagged high for staff, whatever quantity was sent', async () => {
    lock(stayingBooking());

    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { serviceId: 'svc-groom', date: '2026-12-13', quantity: 3 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).resolves.toMatchObject({ quantity: 1, amount: 55 });
    expect(insertAddOnTask).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ priority: 'high' }),
    );
  });

  it.each([
    ['a service that is not an add-on', { serviceId: 'svc-room', date: '2026-12-13' }],
    ['a day outside the stay', { serviceId: 'svc-walk', date: '2026-12-15' }],
    ['a day already past', { serviceId: 'svc-walk', date: '2026-12-12' }],
  ])('refuses %s', async (_label, input) => {
    lock(stayingBooking());
    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { ...input, quantity: 1 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'ADD_ON_NOT_OFFERED' });
    expect(cards.chargeNow).not.toHaveBeenCalled();
  });

  it('refuses a pet that is not on this booking', async () => {
    lock(stayingBooking());
    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-z',
        { serviceId: 'svc-walk', date: '2026-12-13', quantity: 1 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('charges nothing when the price differs from the one the parent saw', async () => {
    lock(stayingBooking());
    await expect(
      bookAddOn(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { serviceId: 'svc-walk', date: '2026-12-13', quantity: 1, expectedAmount: 12 },
        { now: DURING_STAY, cardProcessor: cards },
      ),
    ).rejects.toMatchObject({ code: 'ADD_ON_PRICE_CHANGED', details: [{ amount: 15 }] });
    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(insertAddOnTask).not.toHaveBeenCalled();
  });
});
