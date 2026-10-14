import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';

export type DatabaseTransactionResult<T> =
  { transaction: 'commit'; value: T } | { transaction: 'rollback'; value: T };

export interface DatabaseTransactionOptions {
  readonly schema?: 'public';
}

export const withDatabaseTransaction = async <T>(
  operation: (client: PoolClient) => Promise<DatabaseTransactionResult<T>>,
  options: DatabaseTransactionOptions = {},
): Promise<T> => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    if (options.schema === 'public') {
      await client.query('SET LOCAL search_path TO public');
    }

    const result = await operation(client);

    if (result.transaction === 'rollback') {
      transactionStarted = false;
      await client.query('ROLLBACK');
      return result.value;
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return result.value;
  } catch (error: unknown) {
    if (transactionStarted) {
      transactionStarted = false;
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original operation or transaction error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
};
