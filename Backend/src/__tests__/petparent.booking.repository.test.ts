import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  createBooking,
  type CreateBookingInput,
} from '../repositories/petparent.booking.repository.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const client = { query: vi.fn(), release: vi.fn() };

const input = (overrides: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
  petOwnersUuid: '00000000-0000-4000-8000-000000000301',
  pets: [
    {
      petId: '00000000-0000-4000-8000-000000000401',
      dropOffAt: new Date('2026-10-11T20:00:00.000Z'),
      pickUpAt: new Date('2026-10-15T04:00:00.000Z'),
      services: [],
      info: {
        feedingRoutine: '',
        medInstruction: '',
        firstTimeBoarding: null,
        crateTrained: null,
        socialAllow: null,
        fullyVaccinated: null,
        behaveNHealth: '',
        others: '',
      },
    },
  ],
  agreement: {
    termsVersionsUuid: 'terms-uuid',
    fullName: 'Ava Mitchell',
    signatureUrl: null,
    agreedAt: new Date('2026-10-01T02:00:00.000Z'),
  },
  payment: { processor: 'test', processorPaymentMethodId: 'pm_test', amount: 204, currency: 'NZD' },
  ...overrides,
});

const statements = (): string[] => client.query.mock.calls.map(([sql]) => String(sql));

const paramsOf = (fragment: string): unknown[] | undefined =>
  client.query.mock.calls.find(([sql]) => String(sql).includes(fragment))?.[1] as
    unknown[] | undefined;

describe('createBooking', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO bookings')) {
        return { rows: [{ uuid: 'booking-uuid', created_at: new Date('2026-10-01T02:01:00Z') }] };
      }
      if (sql.includes('RETURNING uuid')) return { rows: [{ uuid: 'row-uuid' }] };
      return { rows: [] };
    });
    vi.mocked(pool.connect).mockResolvedValue(client as never);
  });

  it('keeps the classic form a paid booking with pets waiting for review', async () => {
    await createBooking(input());

    expect(paramsOf('INSERT INTO booking_pets (')?.[4]).toBe('pending');
    expect(paramsOf('INSERT INTO booking_payments')?.slice(4)).toEqual(['succeeded', null]);
    expect(paramsOf('UPDATE bookings SET status')).toEqual(['booking-uuid', 'paid']);
    expect(statements().at(-1)).toBe('COMMIT');
  });

  it('records a concierge booking as confirmed, with its pets approved and its card held', async () => {
    const base = input();
    await createBooking({
      ...base,
      payment: { ...base.payment, status: 'authorized', processorPaymentIntentId: 'pi_123' },
      recording: { bookingStatus: 'confirmed', petReviewStatus: 'approved' },
    });

    expect(paramsOf('INSERT INTO booking_pets (')?.[4]).toBe('approved');
    expect(paramsOf('INSERT INTO booking_payments')?.slice(4)).toEqual(['authorized', 'pi_123']);
    expect(paramsOf('UPDATE bookings SET status')).toEqual(['booking-uuid', 'confirmed']);
  });

  it('runs the guard first inside the transaction', async () => {
    const beforeWrite = vi.fn(async () => {
      expect(statements()).toEqual(['BEGIN']);
    });

    await createBooking(input({ beforeWrite }));

    expect(beforeWrite).toHaveBeenCalledWith(client);
  });

  it('writes nothing and rolls back when the guard refuses', async () => {
    const beforeWrite = vi.fn(async () => {
      throw new Error('full');
    });

    await expect(createBooking(input({ beforeWrite }))).rejects.toThrow('full');

    expect(statements()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalled();
  });
});
