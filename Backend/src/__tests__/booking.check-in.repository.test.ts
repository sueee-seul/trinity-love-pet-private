import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  cancelActivePets,
  saveArrival,
  settlePayment,
  withLockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { listAllBookings } from '../repositories/manager.booking.repository.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

const BOOKING_ID = '1a2b3c4d-0000-4000-8000-000000000001';

type QueryResultStub = { rows: unknown[]; rowCount?: number };

const client = {
  query: vi.fn<(sql: string, values?: unknown[]) => Promise<QueryResultStub>>(),
  release: vi.fn(),
};

/** The positional placeholders a statement uses, so every one of them has a value. */
const placeholdersIn = (sql: string): number[] =>
  [...new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))].sort(
    (left, right) => left - right,
  );

const lastPoolQuery = (): { sql: string; params: unknown[] } => {
  const [sql, params] = vi.mocked(pool.query).mock.calls.at(-1) as unknown as [string, unknown[]];
  return { sql, params };
};

beforeEach(() => {
  vi.mocked(pool.query).mockReset();
  vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
  vi.mocked(pool.connect).mockReset();
  vi.mocked(pool.connect).mockResolvedValue(client as never);
  client.query.mockReset();
  client.query.mockResolvedValue({ rows: [], rowCount: 0 });
  client.release.mockReset();
});

describe('manager booking list', () => {
  it('counts nights in Auckland dates, as the stay was priced', async () => {
    await listAllBookings({ stripeTestMode: true });

    const { sql, params } = lastPoolQuery();
    // A 10:30 Auckland drop-off is the previous day in UTC: counting UTC dates added a night.
    expect(sql).not.toContain('bp.pick_up_time::date - bp.drop_off_time::date');
    expect(sql).toContain("(bp.pick_up_time AT TIME ZONE 'Pacific/Auckland')::date");
    expect(sql).toContain("(bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date");
    // $3: the first pay-at-request terms, which decide each booking's fee rules. $4: the ledger's
    // processor for an amount owed at the desk, summed as what is to pay at check-out.
    expect(placeholdersIn(sql)).toEqual([1, 2, 3, 4]);
    expect(params).toEqual([['stripe', 'fake'], true, 'concierge-terms-2026-10-02', 'desk']);
  });
});

describe('desk SQL guards', () => {
  it('records an arrival only for a pet on a booking that is not settled', async () => {
    const at = new Date('2026-12-11T20:00:00Z');

    await saveArrival('booking-pet-1', 'no_show', at);

    const { sql, params } = lastPoolQuery();
    // Only a stay a manager approved is checked in; a request nobody decided is not a booking.
    expect(sql).toContain("bp.manager_review_status = 'approved'");
    expect(sql).toContain('pay.captured_amount IS NOT NULL');
    expect(placeholdersIn(sql)).toEqual([1, 2, 3]);
    expect(params).toEqual(['booking-pet-1', 'no_show', at]);
  });

  it('locks the card payment before reading the pets, and commits what the work wrote', async () => {
    const dropOffAt = new Date('2026-12-11T21:30:00Z');
    const pickUpAt = new Date('2026-12-15T03:00:00Z');
    const bookedAt = new Date('2026-11-01T01:00:00Z');
    client.query.mockImplementation(async (sql) =>
      sql.includes('FROM booking_pets bp')
        ? {
            rows: [
              {
                booking_pets_uuid: 'pet-a',
                review_status: 'approved',
                approved_at: null,
                outcome: null,
                price: '210.00',
                nightly_rate: '60.00',
                flat_price: '30.00',
                drop_off_at: dropOffAt,
                pick_up_at: pickUpAt,
                owner_id: 'owner-1',
                booked_at: bookedAt,
                reschedule_count: 1,
              },
            ],
          }
        : { rows: [] },
    );

    const seen = await withLockedBooking(BOOKING_ID, async (booking) => booking);

    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('FOR UPDATE OF pay');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(seen).toEqual({
      bookingId: BOOKING_ID,
      ownerId: 'owner-1',
      bookedAt,
      // No agreement row in this script: an older booking.
      paysAtRequest: false,
      termsVersion: '',
      rescheduleCount: 1,
      payment: null,
      pets: [
        {
          bookingPetsUuid: 'pet-a',
          reviewStatus: 'approved',
          approvedAt: null,
          outcome: null,
          price: 210,
          nightlyRate: 60,
          flatPrice: 30,
          dropOffAt,
          pickUpAt,
        },
      ],
    });
  });

  it('rolls back when the work fails, so nothing half-done is kept', async () => {
    client.query.mockImplementation(async (sql) =>
      sql.includes('FROM booking_pets bp')
        ? {
            rows: [
              {
                booking_pets_uuid: 'pet-a',
                review_status: 'approved',
                approved_at: null,
                outcome: null,
                price: '1',
              },
            ],
          }
        : { rows: [] },
    );

    await expect(
      withLockedBooking(BOOKING_ID, async () => {
        throw new Error('processor down');
      }),
    ).rejects.toThrow('processor down');

    expect(client.query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('settles the payment and cancels only pets that have not arrived', async () => {
    await settlePayment(client as never, 'payment-1', { status: 'canceled', capturedAmount: 0 });
    await cancelActivePets(client as never, BOOKING_ID, 'Red warning');

    const [[settleSql, settleParams], [cancelSql, cancelParams]] = client.query.mock.calls as [
      [string, unknown[]],
      [string, unknown[]],
    ];
    expect(placeholdersIn(settleSql)).toEqual([1, 2, 3, 4]);
    expect(settleParams).toEqual(['payment-1', 'canceled', 0, null]);
    expect(cancelSql).toContain('check_in_outcome IS NULL');
    expect(cancelSql).toContain("manager_review_status IN ('pending', 'approved')");
    expect(cancelParams).toEqual([BOOKING_ID, 'Red warning']);
  });
});
