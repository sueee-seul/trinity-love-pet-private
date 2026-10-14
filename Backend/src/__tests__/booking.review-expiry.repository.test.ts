import { beforeEach, describe, expect, it, vi } from 'vitest';

// The SQL is checked against PGlite during development; these tests pin what the query must keep.

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: poolQuery } }));

import { findWaitingRequests } from '../repositories/booking.review-expiry.repository.js';

const sentSql = (): string => String(poolQuery.mock.calls[0]?.[0]).replace(/\s+/g, ' ');

beforeEach(() => {
  poolQuery.mockReset();
  poolQuery.mockResolvedValue({ rows: [] });
});

describe('the requests the review job releases', () => {
  it('reads every booking, giving an older one its drop-off as the deadline', async () => {
    await findWaitingRequests(new Date('2026-10-05T00:00:00Z'), 24, 4);

    const sql = sentSql();
    // Not limited to pay-at-request bookings: an older request nobody decided is released too.
    expect(sql).toContain('LEFT JOIN bookings_agreements ba');
    expect(sql).toMatch(
      /THEN LEAST\(b\.created_at \+ make_interval\(hours => \$2::int\), MIN\(bp\.drop_off_time\)\) ELSE MIN\(bp\.drop_off_time\) END AS deadline/,
    );
    expect(sql).toContain("b.status IN ('paid', 'confirmed')");
  });

  it('keeps a request whose pet profile was deleted, under the name it was booked with', async () => {
    await findWaitingRequests(new Date('2026-10-05T00:00:00Z'), 24, 4);

    const sql = sentSql();
    expect(sql).toContain('LEFT JOIN pets pet ON pet.uuid = bp.pet_uuid');
    expect(sql).toContain('COALESCE(pet.name, bp.pet_name)');
  });
});
