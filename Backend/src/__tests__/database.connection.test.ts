import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock('../config/database.js', () => ({
  pool: { connect: connectMock },
}));

import {
  DatabaseUnavailableError,
  withDatabaseConnection,
} from '../repositories/database.connection.js';

describe('database connection helpers', () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  it('prepares a regular connection with the public application schema', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client);

    await expect(
      withDatabaseConnection(
        async (connection) => {
          await connection.query('SELECT 1');
          return 'ok';
        },
        'regular connection test',
        { schema: 'public' },
      ),
    ).resolves.toBe('ok');

    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      'SET search_path TO public',
      'SELECT 1',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('maps connection acquisition failure to DatabaseUnavailableError', async () => {
    connectMock.mockRejectedValue(new Error('connection refused'));

    await expect(
      withDatabaseConnection(async () => 'never', 'connection unavailable'),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
  });
});
