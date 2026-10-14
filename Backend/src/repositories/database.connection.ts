import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';

export class DatabaseUnavailableError extends Error {
  public readonly code = 'DATABASE_UNAVAILABLE';
  public readonly statusCode = 503;

  constructor() {
    super('Database is unavailable');
    this.name = 'DatabaseUnavailableError';
    Object.setPrototypeOf(this, DatabaseUnavailableError.prototype);
  }
}

export interface DatabaseConnectionOptions {
  readonly schema?: 'public';
}

/**
 * Runs a repository operation against a prepared PostgreSQL connection.
 * Callers that cross the pooled Google Review boundary can opt into the
 * public schema because pooled sessions may not provide a usable search_path.
 * Schema changes and seed data belong to SQL schema/migration artifacts,
 * never to a request-time path.
 */
export const withDatabaseConnection = async <T>(
  work: (client: PoolClient) => Promise<T>,
  context: string,
  options: DatabaseConnectionOptions = {},
): Promise<T> => {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    console.error(`[database] ${context} could not acquire a PostgreSQL connection`);
    throw new DatabaseUnavailableError();
  }

  try {
    if (options.schema === 'public') {
      await client.query('SET search_path TO public');
    }
    return await work(client);
  } catch (error) {
    console.error(
      `[database] ${context} failed`,
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw error;
  } finally {
    client.release();
  }
};
