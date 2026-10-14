import { beforeEach, describe, expect, it, vi } from 'vitest';

// The decision and the parent's notice share one transaction. These tests follow the statements
// the repository sends on its one client, with the database replaced by a script.

const { clientQuery, release } = vi.hoisted(() => ({ clientQuery: vi.fn(), release: vi.fn() }));
vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn(async () => ({ query: clientQuery, release })) },
}));

import {
  approveBookingPet,
  refuseBookingPet,
  resetBookingPetReview,
  type DecisionNoticeComposer,
} from '../repositories/manager.booking.review.repository.js';

const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';
const MANAGER_ID = '00000000-0000-4000-8000-000000000701';
const LOCKED_ROW = {
  booking_id: '00000000-0000-4000-8000-000000000501',
  owner_id: '00000000-0000-4000-8000-000000000301',
  pet_name: 'Max',
  drop_off_time: new Date('2026-10-11T20:00:00.000Z'),
  pick_up_time: new Date('2026-10-15T04:00:00.000Z'),
  manager_review_status: 'pending',
  refusal_reason: null,
};

const NOTICE = {
  ownerId: LOCKED_ROW.owner_id,
  bookingId: LOCKED_ROW.booking_id,
  kind: 'booking_approved' as const,
  body: "Max's stay is approved.",
};

const sentStatements = (): string[] =>
  clientQuery.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

const scriptDatabase = (options: { lockedRows?: unknown[]; noticeFails?: boolean } = {}): void => {
  clientQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE OF bp')) {
      return { rows: options.lockedRows ?? [LOCKED_ROW], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO pet_owners_notification') && options.noticeFails) {
      throw new Error('notice insert failed');
    }
    return { rows: [], rowCount: 1 };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  scriptDatabase();
});

describe('manager review decisions', () => {
  it('locks the pet, saves the decision and writes the notice in one transaction', async () => {
    const compose = vi.fn<DecisionNoticeComposer>(() => NOTICE);

    await expect(approveBookingPet(BOOKING_PET_ID, MANAGER_ID, compose)).resolves.toBe(true);

    const statements = sentStatements();
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('FOR UPDATE OF bp');
    expect(statements[2]).toContain('UPDATE booking_pets SET manager_review_status = $2::varchar');
    expect(statements[2]).toContain("WHEN $2::varchar <> 'approved'");
    expect(statements[3]).toBe('SAVEPOINT booking_parent_notice');
    expect(statements[4]).toContain('INSERT INTO notification');
    expect(statements[5]).toBe('RELEASE SAVEPOINT booking_parent_notice');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(statements[2]).toContain('reviewed_by_uuid = $4::uuid');
    expect(clientQuery.mock.calls[2]?.[1]).toEqual([BOOKING_PET_ID, 'approved', null, MANAGER_ID]);
    expect(clientQuery.mock.calls[4]?.[1]).toEqual([
      NOTICE.ownerId,
      'booking_approved',
      'booking',
      NOTICE.bookingId,
      NOTICE.body,
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('composes the notice from the status the decision replaced', async () => {
    scriptDatabase({
      lockedRows: [{ ...LOCKED_ROW, manager_review_status: 'refused', refusal_reason: 'Full.' }],
    });
    const compose = vi.fn<DecisionNoticeComposer>(() => null);

    await refuseBookingPet(BOOKING_PET_ID, MANAGER_ID, 'No space.', compose);

    expect(compose).toHaveBeenCalledWith({
      bookingId: LOCKED_ROW.booking_id,
      ownerId: LOCKED_ROW.owner_id,
      subject: {
        petNames: ['Max'],
        dropOffTime: LOCKED_ROW.drop_off_time,
        pickUpTime: LOCKED_ROW.pick_up_time,
      },
      previousStatus: 'refused',
      previousRefusalReason: 'Full.',
    });
    expect(clientQuery.mock.calls[2]?.[1]).toEqual([
      BOOKING_PET_ID,
      'refused',
      'No space.',
      MANAGER_ID,
    ]);
  });

  it('keeps the decision when the notice cannot be written', async () => {
    scriptDatabase({ noticeFails: true });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(approveBookingPet(BOOKING_PET_ID, MANAGER_ID, () => NOTICE)).resolves.toBe(true);

    const statements = sentStatements();
    expect(statements).toContain('ROLLBACK TO SAVEPOINT booking_parent_notice');
    expect(statements).not.toContain('ROLLBACK');
    expect(statements.at(-1)).toBe('COMMIT');
    // Ids and the error name only: the notice text holds the pet's name.
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('Max');
    consoleError.mockRestore();
  });

  it('writes no notice when the decision tells the parent nothing new', async () => {
    await resetBookingPetReview(BOOKING_PET_ID, () => null);

    const statements = sentStatements();
    expect(statements.some((sql) => sql.includes('notification'))).toBe(false);
    // Back in review, nobody has decided: the reviewer is cleared with the decision.
    expect(clientQuery.mock.calls[2]?.[1]).toEqual([BOOKING_PET_ID, 'pending', null, null]);
    expect(statements.at(-1)).toBe('COMMIT');
  });

  it('changes nothing and reports not found for an unknown booking pet', async () => {
    scriptDatabase({ lockedRows: [] });
    const compose = vi.fn<DecisionNoticeComposer>(() => NOTICE);

    await expect(approveBookingPet(BOOKING_PET_ID, MANAGER_ID, compose)).resolves.toBe(false);

    expect(compose).not.toHaveBeenCalled();
    const statements = sentStatements();
    expect(statements.some((sql) => sql.startsWith('UPDATE'))).toBe(false);
    expect(statements.at(-1)).toBe('ROLLBACK');
  });

  it('can still decide a stay whose pet profile the owner deleted, under the booked name', async () => {
    await refuseBookingPet(BOOKING_PET_ID, null, 'Not decided in time.', () => null);

    const lock = sentStatements().find((sql) => sql.includes('FOR UPDATE OF bp')) ?? '';
    expect(lock).toContain('LEFT JOIN pets p ON p.uuid = bp.pet_uuid');
    expect(lock).toContain('COALESCE(p.name, bp.pet_name) AS pet_name');
  });
});
