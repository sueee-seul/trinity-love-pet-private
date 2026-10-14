import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  countPetsPerNight,
  lockBookingCapacity,
  readFacilityCapacity,
  type SqlRunner,
} from '../repositories/booking.capacity.repository.js';
import { assertRoomForStay, findFullNights, nightsOfStay } from '../services/booking.capacity.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const STAY = { startDate: '2026-10-12', endDate: '2026-10-15', petCount: 2 };

interface FakeClient {
  client: SqlRunner;
  query: ReturnType<typeof vi.fn>;
}

const fakeClient = (answer: (sql: string) => unknown[]): FakeClient => {
  const query = vi.fn(async (sql: string) => ({ rows: answer(sql) }));
  return { client: { query } as unknown as SqlRunner, query };
};

/** A transaction client that answers the capacity, then the per-night count. */
const clientAnswering = (capacity: number, booked: number[]): FakeClient =>
  fakeClient((sql) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    if (sql.includes('FROM facilities')) return [{ capacity }];
    return nightsOfStay(STAY.startDate, STAY.endDate).map((night, index) => ({
      night,
      booked: booked[index] ?? 0,
    }));
  });

describe('nightsOfStay', () => {
  it('counts the drop-off night up to the night before pick-up', () => {
    expect(nightsOfStay('2026-10-12', '2026-10-15')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ]);
  });

  it('crosses a month end and a daylight saving change as whole dates', () => {
    expect(nightsOfStay('2026-09-26', '2026-09-29')).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
    ]);
    expect(nightsOfStay('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('has no nights when pick-up is not after drop-off', () => {
    expect(nightsOfStay('2026-10-12', '2026-10-12')).toEqual([]);
  });
});

describe('findFullNights', () => {
  it('names only the nights that cannot take the extra pets', async () => {
    const { client } = clientAnswering(40, [37, 38, 39]);

    // 38 + 2 fits exactly; 39 + 2 is one too many.
    await expect(findFullNights(STAY, client)).resolves.toEqual(['2026-10-14']);
  });

  it('refuses to guess when no single facility defines the capacity', async () => {
    const { client } = fakeClient(() => []);

    await expect(findFullNights(STAY, client)).rejects.toMatchObject({
      code: 'CONCIERGE_NOT_CONFIGURED',
      statusCode: 503,
    });
  });
});

describe('assertRoomForStay', () => {
  it('takes the booking lock before counting', async () => {
    const { client, query } = clientAnswering(40, [0, 0, 0]);

    await assertRoomForStay(client, STAY);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toContain('pg_advisory_xact_lock');
    expect(statements).toHaveLength(3);
  });

  it('throws CONCIERGE_FULLY_BOOKED with each full night', async () => {
    const { client } = clientAnswering(2, [1, 0, 2]);

    await expect(assertRoomForStay(client, STAY)).rejects.toMatchObject({
      code: 'CONCIERGE_FULLY_BOOKED',
      statusCode: 409,
      details: [{ night: '2026-10-12' }, { night: '2026-10-14' }],
    });
  });
});

describe('booking capacity repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('counts only live stays and binds the date range', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await countPetsPerNight('2026-10-12', '2026-10-14');

    const [sql, params] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("b.status IN ('paid', 'confirmed')");
    expect(sql).toContain("bp.manager_review_status IN ('pending', 'approved')");
    expect(sql).toContain("bp.check_in_outcome IS NULL OR bp.check_in_outcome = 'checked_in'");
    expect(sql).toContain('generate_series($1::date, $2::date');
    expect(params).toEqual(['2026-10-12', '2026-10-14', null]);
  });

  it('leaves out a booking that is moving to new dates', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await countPetsPerNight('2026-10-12', '2026-10-14', pool, 'booking-1');

    const [sql, params] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('($3::uuid IS NULL OR b.uuid <> $3::uuid)');
    expect(params).toEqual(['2026-10-12', '2026-10-14', 'booking-1']);
  });

  it('reads the capacity only when exactly one facility exists', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ capacity: '40' }] } as never);
    await expect(readFacilityCapacity()).resolves.toBe(40);

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ capacity: 40 }, { capacity: 10 }],
    } as never);
    await expect(readFacilityCapacity()).resolves.toBeNull();
  });

  it('locks with a transaction-scoped advisory lock', async () => {
    const { client, query } = fakeClient(() => []);

    await lockBookingCapacity(client);

    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [20260929]);
  });
});
