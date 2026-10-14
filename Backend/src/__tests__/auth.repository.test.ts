import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  createPetParentAccount,
  createGooglePetParentAccount,
  findUserByCredentials,
  findUserByEmail,
  updateUserPasswordByEmail,
  updateUserPasswordFromTemporary,
} from '../repositories/auth.repository.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

const databaseUser = {
  id: '00000000-0000-4000-8000-000000000201',
  email: 'employee@example.test',
  username: 'employee.one',
  name: 'Employee One',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
  is_temporary_password: false,
};

describe('auth repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.connect).mockReset();
  });

  it('finds a user by case-insensitive email without selecting password_hash', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [databaseUser] } as never);

    await expect(findUserByEmail('employee@example.test')).resolves.toEqual(databaseUser);

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('FROM users AS u');
    expect(String(query)).toContain('LEFT JOIN employees AS e ON e.users_uuid = u.uuid');
    expect(String(query)).toContain('u.is_employee');
    expect(String(query)).toContain('u.is_pet_owner');
    expect(String(query)).toContain('e.staff_role');
    expect(String(query)).toContain('LOWER(u.email) = LOWER($1)');
    expect(String(query)).not.toContain('u.password_hash,');
    expect(values).toEqual(['employee@example.test']);
  });

  it('delegates password verification to PostgreSQL crypt()', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [databaseUser] } as never);

    await expect(findUserByCredentials('employee@example.test', 'Database1!')).resolves.toEqual(
      databaseUser,
    );

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('u.password_hash = crypt($2, u.password_hash)');
    expect(String(query)).not.toContain('Database1!');
    expect(values).toEqual(['employee@example.test', 'Database1!']);
  });

  it('accepts a manager-provisioned temporary hash without adding a schema field', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ ...databaseUser, is_temporary_password: true }],
    } as never);

    await expect(findUserByCredentials('employee@example.test', 'Temporary1!')).resolves.toEqual({
      ...databaseUser,
      is_temporary_password: true,
    });

    const [query] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain("u.password_hash LIKE 'temporary:%'");
    expect(String(query)).toContain('substring(u.password_hash FROM 11)');
    expect(String(query)).not.toContain('ALTER TABLE');
  });

  it('returns null when PostgreSQL finds no matching user', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      findUserByCredentials('employee@example.test', 'wrong-password'),
    ).resolves.toBeNull();
  });

  it('creates users and pet_owners in one transaction with a database-generated hash', async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000301',
            email: 'new.parent@example.test',
            username: 'new-parent',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ first_name: 'New', last_name: 'Parent' }] })
      .mockResolvedValueOnce({});

    await expect(
      createPetParentAccount({
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        emergencyContactNumber: '+64 21 555 0000',
        firstName: 'New',
        lastName: 'Parent',
        address: '1 New Street, Auckland',
        dateOfBirth: '1990-01-01',
      }),
    ).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000301',
      email: 'new.parent@example.test',
      username: 'new-parent',
      name: 'New Parent',
    });

    const [userQuery, userValues] = client.query.mock.calls[1] ?? [];
    expect(String(userQuery)).toContain("crypt($3, gen_salt('bf', 12))");
    expect(String(userQuery)).not.toContain('Sunrise1!');
    expect(userValues).toEqual(['new-parent', 'new.parent@example.test', 'Sunrise1!']);
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back account creation when the pet owner profile insert fails', async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000301',
            email: 'new.parent@example.test',
            username: 'new-parent',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('profile insert failed'));

    await expect(
      createPetParentAccount({
        email: 'new.parent@example.test',
        username: 'new-parent',
        password: 'Sunrise1!',
        emergencyContactNumber: '+64 21 555 0000',
        firstName: 'New',
        lastName: 'Parent',
        address: '1 New Street, Auckland',
        dateOfBirth: '1990-01-01',
      }),
    ).rejects.toThrow('profile insert failed');

    expect(client.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('creates a Google pet parent account in one transaction', async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000302',
            email: 'google.parent@example.test',
            username: 'google-parent',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ first_name: 'Google', last_name: 'Parent' }] })
      .mockResolvedValueOnce({});

    await expect(
      createGooglePetParentAccount({
        email: 'google.parent@example.test',
        username: 'google-parent',
        emergencyContactNumber: '+64 21 555 0001',
        firstName: 'Google',
        lastName: 'Parent',
        address: '2 Google Street, Auckland',
        dateOfBirth: '1991-02-02',
      }),
    ).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000302',
      email: 'google.parent@example.test',
      username: 'google-parent',
      name: 'Google Parent',
    });

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back Google account creation when the pet owner profile insert fails', async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000302',
            email: 'google.parent@example.test',
            username: 'google-parent',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('Google profile insert failed'));

    await expect(
      createGooglePetParentAccount({
        email: 'google.parent@example.test',
        username: 'google-parent',
        emergencyContactNumber: '+64 21 555 0001',
        firstName: 'Google',
        lastName: 'Parent',
        address: '2 Google Street, Auckland',
        dateOfBirth: '1991-02-02',
      }),
    ).rejects.toThrow('Google profile insert failed');

    expect(client.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('updates only the selected user password with a generated salt', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-4000-8000-000000000301', email: 'parent@example.test' }],
    } as never);

    await expect(updateUserPasswordByEmail('parent@example.test', 'Sunrise1!')).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000301',
      email: 'parent@example.test',
    });

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain("crypt($1, gen_salt('bf', 12))");
    expect(String(query)).not.toContain('Sunrise1!');
    expect(values).toEqual(['Sunrise1!', 'parent@example.test']);
  });

  it('rewrites only a temporary password hash and removes its internal marker', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: databaseUser.id, email: databaseUser.email }],
    } as never);

    await expect(updateUserPasswordFromTemporary(databaseUser.id, 'NewSecure1!')).resolves.toEqual({
      id: databaseUser.id,
      email: databaseUser.email,
    });

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain("password_hash LIKE 'temporary:%'");
    expect(String(query)).toContain("SET password_hash = crypt($1, gen_salt('bf', 12))");
    expect(String(query)).not.toContain('ALTER TABLE');
    expect(values).toEqual(['NewSecure1!', databaseUser.id]);
  });
});
