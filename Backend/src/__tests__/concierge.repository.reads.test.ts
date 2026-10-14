import { beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: poolQuery, connect: vi.fn() } }));

import {
  emailHasPasswordAccount,
  findSavedPetSpecies,
} from '../repositories/concierge.repository.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const PET_ID = '00000000-0000-4000-8000-000000000401';

// The checkout tests mock these reads, so a statement with a missing `$n` (a syntax error in
// PostgreSQL) passed every test. Each value must be bound to its own numbered placeholder.
const sent = (): { sql: string; params: unknown[] } => {
  const [sql, params] = poolQuery.mock.calls[0] ?? [];
  return { sql: String(sql), params: Array.isArray(params) ? params : [] };
};

const placeholderNumbers = (sql: string): number[] =>
  [...new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))].sort(
    (left, right) => left - right,
  );

const expectEveryValueBound = (): void => {
  const { sql, params } = sent();
  expect(placeholderNumbers(sql)).toEqual(params.map((_value, index) => index + 1));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('concierge account reads', () => {
  it('compares the email without case, bound to its placeholder', async () => {
    poolQuery.mockResolvedValue({ rows: [{ has_password: true }], rowCount: 1 });

    await expect(emailHasPasswordAccount('Max.Owner@Example.test')).resolves.toBe(true);

    expectEveryValueBound();
    expect(sent().sql).toContain('LOWER(email) = LOWER($1)');
    expect(sent().params).toEqual(['Max.Owner@Example.test']);
  });

  it('reports no password when no account has the email', async () => {
    poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(emailHasPasswordAccount('new@example.test')).resolves.toBe(false);
  });
});

describe('concierge saved pet reads', () => {
  it("reads only the signed-in owner's pets, with both values bound", async () => {
    poolQuery.mockResolvedValue({ rows: [{ id: PET_ID, species: 'dog' }], rowCount: 1 });

    const species = await findSavedPetSpecies(OWNER_ID, [PET_ID]);

    expect(species).toEqual(new Map([[PET_ID, 'dog']]));
    expectEveryValueBound();
    expect(sent().sql).toContain('pet_owners_uuid = $1::uuid AND uuid = ANY($2::uuid[])');
    expect(sent().params).toEqual([OWNER_ID, [PET_ID]]);
  });

  it('asks the database nothing when no saved pet was chosen', async () => {
    await expect(findSavedPetSpecies(OWNER_ID, [])).resolves.toEqual(new Map());
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
