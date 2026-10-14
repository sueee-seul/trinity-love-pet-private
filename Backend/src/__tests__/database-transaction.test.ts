import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';

vi.mock('../config/database.js', () => ({
  pool: {
    connect: vi.fn(),
  },
}));

describe('withDatabaseTransaction', () => {
  beforeEach(() => {
    vi.mocked(pool.connect).mockReset();
  });

  it('rolls back an explicit non-success result and releases the client', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    await expect(
      withDatabaseTransaction(
        async () => ({
          transaction: 'rollback',
          value: 'not-found',
        }),
        { schema: 'public' },
      ),
    ).resolves.toBe('not-found');

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'SET LOCAL search_path TO public');
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('preserves the operation error when rollback also fails', async () => {
    const operationError = new Error('operation failed');
    const client = {
      query: vi.fn().mockImplementation(async (query: string) => {
        if (query === 'ROLLBACK') {
          throw new Error('rollback failed');
        }
        return {};
      }),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    await expect(
      withDatabaseTransaction(
        async () => {
          throw operationError;
        },
        { schema: 'public' },
      ),
    ).rejects.toBe(operationError);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'SET LOCAL search_path TO public');
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
