import { beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: poolQuery, connect: vi.fn() } }));

import {
  BOOKING_ARRIVAL_UNMARKED,
  BOOKING_MOVED_BY_STAFF,
} from '../contracts/booking.notification.contract.js';
import {
  findBookingRequestSubject,
  insertManagerFlag,
  insertManagerNotice,
  recordManagerRequestNotices,
  recordParentNotice,
} from '../repositories/booking.notification.repository.js';

const BOOKING_ID = '00000000-0000-4000-8000-000000000501';
const OWNER_ID = '00000000-0000-4000-8000-000000000301';

const sent = (): { sql: string; params: unknown[] } => {
  const [sql, params] = poolQuery.mock.calls[0] ?? [];
  return { sql: String(sql).replace(/\s+/g, ' '), params: Array.isArray(params) ? params : [] };
};

beforeEach(() => {
  vi.clearAllMocks();
  poolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('booking notice writes', () => {
  it('links a parent notice to its owner in the same statement, in the existing tables', async () => {
    await recordParentNotice({
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_request_received',
      body: 'We got your request.',
    });

    const { sql, params } = sent();
    expect(poolQuery).toHaveBeenCalledTimes(1);
    expect(sql).toContain(
      'INSERT INTO notification (notification_setting, category, booking_uuid, summary_content)',
    );
    expect(sql).toContain(
      'INSERT INTO pet_owners_notification (pet_owners_uuid, notification_uuid)',
    );
    // A parent notice is never assigned to staff, so no manager bell can list it.
    expect(sql).not.toContain('assignee_uuid');
    expect(params).toEqual([
      OWNER_ID,
      'booking_request_received',
      'booking',
      BOOKING_ID,
      'We got your request.',
    ]);
  });

  it('writes one manager notice per active manager and reports how many', async () => {
    poolQuery.mockResolvedValue({ rows: [], rowCount: 2 });

    await expect(
      recordManagerRequestNotices({ bookingId: BOOKING_ID, body: 'Max, 12 to 15 Oct 2026.' }),
    ).resolves.toBe(2);

    const { sql, params } = sent();
    expect(sql).toContain("e.staff_role = 'manager'");
    expect(sql).toContain("e.staff_status = 'active'");
    expect(sql).not.toContain('pet_owners_notification');
    expect(params).toEqual([
      'booking_request_created',
      'booking',
      BOOKING_ID,
      'Max, 12 to 15 Oct 2026.',
    ]);
  });
});

describe('findBookingRequestSubject', () => {
  it("reads the owner, every pet's name and the whole stay of a request", async () => {
    const dropOff = new Date('2026-10-11T20:00:00.000Z');
    const pickUp = new Date('2026-10-15T04:00:00.000Z');
    poolQuery.mockResolvedValue({
      rows: [
        {
          owner_id: OWNER_ID,
          pet_names: ['Max', 'Bella'],
          drop_off_time: dropOff,
          pick_up_time: pickUp,
        },
      ],
    });

    await expect(findBookingRequestSubject(BOOKING_ID)).resolves.toEqual({
      ownerId: OWNER_ID,
      petNames: ['Max', 'Bella'],
      dropOffTime: dropOff,
      pickUpTime: pickUp,
    });
    expect(sent().params).toEqual([BOOKING_ID]);
  });

  it('returns null for a booking with no pets', async () => {
    await expect(findBookingRequestSubject(BOOKING_ID)).resolves.toBeNull();
  });
});

const managerFlagRunner = { query: vi.fn(async () => ({ rows: [], rowCount: 1 })) };

const lastStatement = (): { sql: string; params: unknown[] } => {
  const [sql, params] = managerFlagRunner.query.mock.calls.at(-1) as unknown as [string, unknown[]];
  return { sql, params };
};

describe('booking notices for managers', () => {
  it('raises a flag once per booking, for every active manager', async () => {
    await insertManagerFlag(managerFlagRunner as never, {
      bookingId: 'booking-1',
      setting: BOOKING_ARRIVAL_UNMARKED,
      summary: 'Arrival not recorded',
    });

    const { sql, params } = lastStatement();
    expect(sql).toContain("e.staff_role = 'manager'");
    expect(sql).toContain('NOT EXISTS');
    expect(params).toEqual([
      BOOKING_ARRIVAL_UNMARKED,
      'booking',
      'booking-1',
      'Arrival not recorded',
    ]);
  });

  it('keeps every notice of something staff did', async () => {
    await insertManagerNotice(managerFlagRunner as never, {
      bookingId: 'booking-1',
      setting: BOOKING_MOVED_BY_STAFF,
      summary: 'Moved for a red warning',
    });

    const { sql } = lastStatement();
    expect(sql).toContain('INSERT INTO notification');
    expect(sql).not.toContain('NOT EXISTS');
    // Uncast, Postgres cannot type a parameter used both as a value and in a comparison.
    expect(sql).not.toMatch(/\$\d(?!::)/);
  });
});
