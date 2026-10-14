import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  createOwnerAndPets,
  emailHasPasswordAccount,
  findSavedPetSpecies,
} from '../repositories/concierge.repository.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const PET_ID = '00000000-0000-4000-8000-000000000302';

/**
 * The positional placeholders ($1, $2, ...) a statement uses, in order. The checkout lookups once
 * shipped with every placeholder lost, which PostgreSQL rejects as a syntax error; the service
 * tests mock these functions, so only a check on the SQL text itself catches that.
 */
const placeholdersIn = (sql: string): number[] =>
  [...new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))].sort(
    (left, right) => left - right,
  );

const lastQuery = (): { sql: string; params: unknown[] } => {
  const [sql, params] = vi.mocked(pool.query).mock.calls.at(-1) as unknown as [string, unknown[]];
  return { sql, params };
};

describe('concierge repository checkout lookups', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('binds the email to a placeholder when checking for a password account', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ has_password: true }] } as never);

    await expect(emailHasPasswordAccount('Parent@Example.test')).resolves.toBe(true);

    const { sql, params } = lastQuery();
    expect(sql).toContain('LOWER($1)');
    expect(placeholdersIn(sql)).toEqual([1]);
    expect(params).toEqual(['Parent@Example.test']);
  });

  it('binds the owner and pet ids to placeholders when reading saved pet species', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: PET_ID, species: 'dog' }],
    } as never);

    await expect(findSavedPetSpecies(OWNER_ID, [PET_ID])).resolves.toEqual(
      new Map([[PET_ID, 'dog']]),
    );

    const { sql, params } = lastQuery();
    expect(sql).toContain('pet_owners_uuid = $1::uuid');
    expect(sql).toContain('ANY($2::uuid[])');
    expect(placeholdersIn(sql)).toEqual([1, 2]);
    expect(params).toEqual([OWNER_ID, [PET_ID]]);
  });
});

describe('the account a first-time guest makes at checkout', () => {
  const clientQuery = vi.fn();

  beforeEach(() => {
    clientQuery.mockReset();
    clientQuery.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO users') || sql.includes('INSERT INTO pets')
        ? { rows: [{ id: OWNER_ID }] }
        : { rows: [] },
    );
    vi.mocked(pool.connect).mockResolvedValue({ query: clientQuery, release: vi.fn() } as never);
  });

  const userInsert = (): { sql: string; params: unknown[] } => {
    const call = clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO users'));
    if (!call) throw new Error('No user insert');
    return { sql: String(call[0]), params: call[1] as unknown[] };
  };

  const newOwner = {
    email: 'ava@example.test',
    phone: '021 555 0199',
    firstName: 'Ava',
    lastName: 'Mitchell',
  };

  it('stores the chosen password hashed by the database, never as typed', async () => {
    await createOwnerAndPets({ newOwner: { ...newOwner, password: 'Sunny-days-42' }, pets: [] });

    const { sql, params } = userInsert();
    expect(sql).toContain("crypt($4::text, gen_salt('bf', 12))");
    expect(placeholdersIn(sql)).toEqual([1, 2, 3, 4]);
    expect(params[3]).toBe('Sunny-days-42');
    expect(sql).not.toContain('Sunny-days-42');
  });

  it('leaves the password empty when the account is made without one', async () => {
    await createOwnerAndPets({ newOwner, pets: [] });

    expect(userInsert().params[3]).toBeNull();
  });
});
