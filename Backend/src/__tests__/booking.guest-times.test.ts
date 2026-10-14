import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setPetTimes } from '../repositories/booking.charges.repository.js';
import {
  withLockedBooking,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { changeStayTimes } from '../services/booking.guest-times.js';
import { notifyTimesChanged } from '../services/booking.in-stay.notifications.js';
import {
  DROP_OFF_AT,
  LOCKED_BOOKING_ID,
  lockedBooking,
  lockedPet,
  OWNER_ID,
} from './support/lockedBookingFixtures.js';
import { DURING_STAY, stayingBooking } from './support/stayingBookingFixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  withLockedBooking: vi.fn(),
}));

vi.mock('../repositories/booking.charges.repository.js', () => ({
  DESK_PROCESSOR: 'desk',
  setPetTimes: vi.fn(async () => undefined),
  readPetNamesForBooking: vi.fn(async () => new Map()),
}));

vi.mock('../services/booking.in-stay.notifications.js', () => ({
  notifyTimesChanged: vi.fn(async () => undefined),
}));

const client = {} as PoolClient;

const lock = (booking: LockedBooking): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) => work(booking, client));
};

/** Mon 30 Nov 2026, 09:00 in Auckland: well before the Sat 12 Dec drop-off. */
const BEFORE_STAY = new Date('2026-11-29T20:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('changing a drop-off or pick-up time', () => {
  it('moves the drop-off hour on the booked day before the pet arrives', async () => {
    lock(lockedBooking());

    await expect(
      changeStayTimes(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { dropOffTime: '08:00' },
        { now: BEFORE_STAY },
      ),
    ).resolves.toEqual({
      // 08:00 on Sat 12 Dec in Auckland (NZDT, UTC+13).
      dropOffAt: '2026-12-11T19:00:00.000Z',
      pickUpAt: '2026-12-15T03:00:00.000Z',
    });
    expect(setPetTimes).toHaveBeenCalledWith(client, LOCKED_BOOKING_ID, 'pet-a', {
      dropOffAt: new Date('2026-12-11T19:00:00Z'),
    });
    expect(notifyTimesChanged).toHaveBeenCalledWith(LOCKED_BOOKING_ID, 'pet-a', expect.any(Object));
  });

  it('moves the pick-up hour while the pet is here, and only that', async () => {
    lock(stayingBooking());

    await expect(
      changeStayTimes(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-b',
        { pickUpTime: '12:30' },
        { now: DURING_STAY },
      ),
    ).resolves.toMatchObject({ pickUpAt: '2026-12-14T23:30:00.000Z' });
    expect(setPetTimes).toHaveBeenCalledWith(client, LOCKED_BOOKING_ID, 'pet-b', {
      pickUpAt: new Date('2026-12-14T23:30:00Z'),
    });
  });

  it.each([
    [
      'a drop-off time once the pet has arrived',
      stayingBooking(),
      DURING_STAY,
      { dropOffTime: '12:00' },
    ],
    [
      'a drop-off time already past today',
      lockedBooking(),
      new Date(DROP_OFF_AT.getTime() - 30 * 60_000),
      { dropOffTime: '09:00' },
    ],
    [
      'a pick-up time already past',
      stayingBooking(),
      new Date('2026-12-15T02:00:00Z'),
      { pickUpTime: '14:00' },
    ],
    [
      'a pick-up before the drop-off on a same-day stay',
      lockedBooking({ pets: [lockedPet({ pickUpAt: new Date('2026-12-12T03:00:00Z') })] }),
      BEFORE_STAY,
      { dropOffTime: '17:00', pickUpTime: '09:00' },
    ],
  ])('refuses %s', async (_label, booking, now, input) => {
    lock(booking);
    await expect(
      changeStayTimes(OWNER_ID, LOCKED_BOOKING_ID, 'pet-a', input, { now }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'STAY_TIME_INVALID' });
    expect(setPetTimes).not.toHaveBeenCalled();
  });

  it('answers 404 for another owner, a pet not on the booking, or a cancelled pet', async () => {
    lock(lockedBooking({ ownerId: 'someone-else' }));
    await expect(
      changeStayTimes(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { pickUpTime: '12:00' },
        { now: BEFORE_STAY },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    lock(lockedBooking({ pets: [lockedPet({ reviewStatus: 'cancelled' })] }));
    await expect(
      changeStayTimes(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        'pet-a',
        { pickUpTime: '12:00' },
        { now: BEFORE_STAY },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
