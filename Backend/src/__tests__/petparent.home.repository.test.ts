import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { findHomeStayForOwner, listHomeStays } from '../repositories/petparent.home.repository.js';
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
});
describe('home stay query parameter bindings', () => {
  it('binds list test mode independently of the owner', async () => {
    await listHomeStays('owner', true);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('$2::boolean'), [
      'owner',
      true,
    ]);
  });
  it('does not reuse the boolean parameter as the vaccination stay UUID', async () => {
    expect(await findHomeStayForOwner('owner', 'pet')).toBeNull();
    const [query, values] = vi.mocked(pool.query).mock.calls[0] as unknown as [string, unknown[]];
    expect(query).toContain('pet_owners_uuid = $1::uuid');
    expect(query).toContain('$2::boolean');
    expect(query).toContain('bp.uuid = $3::uuid');
    expect(query).not.toContain('$2::uuid');
    expect(values).toEqual(['owner', false, 'pet']);
  });
});
