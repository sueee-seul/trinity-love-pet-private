import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresConnectionConfig } from './postgres.connection.config.js';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDirectory, '../../../.env.local') });
dotenv.config({ path: path.resolve(configDirectory, '../../.env') });
dotenv.config();

/** The application database connection is configured only through POSTGRESQL_URL. */
export const getDatabaseConnectionString = (): string | undefined => {
  return process.env.POSTGRESQL_URL;
};

const connectionString = getDatabaseConnectionString();
const postgresConnectionConfig = createPostgresConnectionConfig(
  connectionString,
  process.env.NODE_ENV,
);
const testDatabaseTimeouts =
  process.env.NODE_ENV === 'test' ? { query_timeout: 10_000, statement_timeout: 10_000 } : {};
let databasePoolClosed = false;

export const pool = new Pool({
  ...postgresConnectionConfig,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...testDatabaseTimeouts,
});

export const closeDatabasePool = async (): Promise<void> => {
  if (databasePoolClosed) {
    return;
  }
  databasePoolClosed = true;
  await pool.end();
};

export async function checkDatabaseConnection(): Promise<Date | undefined> {
  const result = await pool.query<{ now: Date }>('SELECT NOW() AS now');
  return result.rows[0]?.now;
}
