import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  BOOKING_ARRIVAL_UNMARKED,
  BOOKING_CARD_HOLD_FAILED,
} from '../contracts/booking.notification.contract.js';
import {
  holdReminderStore,
  withBookingJobLock,
} from '../repositories/booking.hold-reminder.repository.js';

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

const clientStatements = (): string[] => client.query.mock.calls.map(([sql]) => sql);

beforeEach(() => {
  vi.mocked(pool.query).mockReset();
  vi.mocked(pool.connect).mockReset();
  vi.mocked(pool.connect).mockResolvedValue(client as never);
  client.query.mockReset();
  client.query.mockResolvedValue({ rows: [], rowCount: 0 });
  client.release.mockReset();
});

describe('booking hold and reminder SQL', () => {
  it('finds card-guaranteed bookings inside the hold window whose reminder has not gone out', async () => {
    const now = new Date('2026-12-09T21:45:00Z');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          booking_id: BOOKING_ID,
          booked_at: new Date('2026-11-01T01:00:00Z'),
          drop_off_at: new Date('2026-12-11T21:30:00Z'),
          pick_up_at: new Date('2026-12-15T03:00:00Z'),
          owner_email: 'ava@example.test',
          owner_first_name: 'Ava',
          pet_names: ['Biscuit'],
          amount: '230.00',
          approved_pets: [
            {
              price: 230,
              nightlyRate: 60,
              approvedAt: '2026-11-02T01:00:00+00:00',
              dropOffAt: '2026-12-11T21:30:00+00:00',
            },
          ],
          payment_status: 'pending',
          released_hold_id: 'pi_released',
          processor: 'stripe',
          payment_method_id: 'pm_saved',
        },
      ],
    } as never);

    const [booking] = await holdReminderStore.findDueBookings(now, 48);

    const { sql, params } = lastPoolQuery();
    expect(sql).toContain("b.status = 'confirmed'");
    expect(sql).toContain('b.reminder_sent_at IS NULL');
    expect(sql).toContain("pay.status IN ('pending', 'authorized', 'failed')");
    // A pay-at-request booking already charged still gets its reminder.
    expect(sql).toContain("pay.status = 'succeeded' AND pay.captured_amount IS NULL");
    expect(sql).toContain('make_interval(hours => $2::int)');
    expect(placeholdersIn(sql)).toEqual([1, 2, 3, 4]);
    expect(params).toEqual([now, 48, ['stripe', 'fake'], 'concierge-terms-2026-10-02']);
    expect(booking).toMatchObject({
      bookingId: BOOKING_ID,
      amount: 230,
      approvedPets: [
        {
          price: 230,
          nightlyRate: 60,
          approvedAt: new Date('2026-11-02T01:00:00Z'),
          dropOffAt: new Date('2026-12-11T21:30:00Z'),
        },
      ],
      paymentStatus: 'pending',
      releasedHoldId: 'pi_released',
    });
  });

  it('holds only the pets a manager approved, at their own prices', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await holdReminderStore.findDueBookings(new Date('2026-12-09T21:45:00Z'), 48);

    const { sql } = lastPoolQuery();
    // A request still waiting for review is not a booking, so it is neither held nor reminded.
    expect(sql).toContain("bp.manager_review_status = 'approved'");
    expect(sql).not.toContain("IN ('pending', 'approved')");
    // The hold is the approved pets' total, not the amount the whole request was quoted at.
    expect(sql).toContain('SUM(COALESCE((');
    expect(sql).not.toContain('pay.amount::text AS amount');
  });

  it('records a hold only while the payment still waits for one, with the flag in the same transaction', async () => {
    client.query.mockImplementation(async (sql) =>
      sql.includes('UPDATE booking_payments')
        ? { rows: [], rowCount: 1 }
        : { rows: [], rowCount: 0 },
    );
    const flag = {
      bookingId: BOOKING_ID,
      setting: BOOKING_CARD_HOLD_FAILED,
      summary: 'Card hold failed',
    };

    await expect(
      holdReminderStore.recordHold(
        BOOKING_ID,
        { status: 'failed', paymentIntentId: 'pi_x', amount: 230 },
        flag,
      ),
    ).resolves.toBe(true);

    const [begin, update, insert, commit] = clientStatements();
    expect(begin).toBe('BEGIN');
    expect(update).toContain("WHERE bookings_uuid = $1::uuid AND status = 'pending'");
    // The payment now guarantees what was held: the approved pets' total.
    expect(update).toContain('amount = $4');
    expect(client.query.mock.calls[1]?.[1]).toEqual([BOOKING_ID, 'failed', 'pi_x', 230]);
    expect(insert).toContain('INSERT INTO notification');
    expect(insert).toContain("e.staff_role = 'manager'");
    expect(insert).toContain('NOT EXISTS');
    expect(placeholdersIn(insert ?? '')).toEqual([1, 2, 3, 4]);
    // $1 is both inserted and compared; uncast, Postgres refuses it ("inconsistent types deduced
    // for parameter $1"), which an in-memory Postgres run caught.
    expect(insert).not.toMatch(/\$\d(?!::)/);
    expect(client.query.mock.calls[2]?.[1]).toEqual([
      BOOKING_CARD_HOLD_FAILED,
      'booking',
      BOOKING_ID,
      'Card hold failed',
    ]);
    expect(commit).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('writes nothing more when the payment no longer waits for a hold', async () => {
    const flag = { bookingId: BOOKING_ID, setting: BOOKING_CARD_HOLD_FAILED, summary: 'x' };

    await expect(
      holdReminderStore.recordHold(
        BOOKING_ID,
        { status: 'failed', paymentIntentId: null, amount: 230 },
        flag,
      ),
    ).resolves.toBe(false);

    expect(clientStatements().some((sql) => sql.includes('INSERT INTO notification'))).toBe(false);
  });

  it('marks the reminder as sent only once', async () => {
    const at = new Date('2026-12-09T21:45:00Z');
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await holdReminderStore.markReminderSent(BOOKING_ID, at);

    const { sql, params } = lastPoolQuery();
    expect(sql).toContain('reminder_sent_at IS NULL');
    expect(params).toEqual([BOOKING_ID, at]);
  });

  it('looks back one week for card-guaranteed arrivals nobody recorded and nobody flagged', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await holdReminderStore.findUnmarkedArrivals('2026-12-13');

    const { sql, params } = lastPoolQuery();
    expect(sql).toContain('bp.check_in_outcome IS NULL');
    expect(placeholdersIn(sql)).toEqual([1, 2, 3, 4]);
    expect(params).toEqual(['2026-12-13', 7, BOOKING_ARRIVAL_UNMARKED, ['stripe', 'fake']]);
  });
});

describe('the jobs lock', () => {
  it('skips the run while another server holds the lock', async () => {
    client.query.mockImplementation(async (sql) =>
      sql.includes('pg_try_advisory_xact_lock') ? { rows: [{ locked: false }] } : { rows: [] },
    );
    const work = vi.fn(async () => undefined);

    await expect(withBookingJobLock(work)).resolves.toBe(false);

    expect(work).not.toHaveBeenCalled();
    expect(clientStatements().at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('runs while holding it and lets it go afterwards, even when the run fails', async () => {
    client.query.mockImplementation(async (sql) =>
      sql.includes('pg_try_advisory_xact_lock') ? { rows: [{ locked: true }] } : { rows: [] },
    );

    await expect(withBookingJobLock(async () => undefined)).resolves.toBe(true);
    await expect(
      withBookingJobLock(async () => {
        throw new Error('run failed');
      }),
    ).rejects.toThrow('run failed');

    expect(clientStatements().filter((sql) => sql === 'ROLLBACK')).toHaveLength(2);
    expect(client.release).toHaveBeenCalledTimes(2);
  });
});
