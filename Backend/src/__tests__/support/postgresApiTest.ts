import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool, type QueryResultRow } from 'pg';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

for (const envFile of [
  path.join(backendDirectory, '.env'),
  path.join(backendDirectory, '.env.local'),
  path.join(backendDirectory, '..', '.env.local'),
]) {
  dotenv.config({ path: envFile });
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl && process.env.POSTGRES_API_TEST_REQUIRED === '1') {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL API integration tests');
}

if (testDatabaseUrl) {
  process.env.NODE_ENV = 'test';
  // The application runtime has one database variable. The isolated test
  // target is injected into it only inside this test process.
  process.env.POSTGRESQL_URL = testDatabaseUrl;
  process.env.GOOGLE_CLIENT_ID = 'postgres-api-test-client';
  process.env.AUTH_SESSION_SECRET = 'postgres-api-test-session-secret';
  process.env.AUTH_SESSION_VERSION = '1';
}

let appPromise: Promise<Express> | null = null;
let databasePool: Pool | null = null;

export const getTestApp = async (): Promise<Express> => {
  appPromise ??= import('../../server.js').then(({ app }) => app);
  return appPromise;
};

export const getTestPool = (): Pool => {
  databasePool ??= new Pool({
    connectionString: testDatabaseUrl,
    max: 4,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });
  return databasePool;
};

export const closePostgresApiTestResources = async (): Promise<void> => {
  if (databasePool) {
    await databasePool.end();
    databasePool = null;
  }

  if (testDatabaseUrl) {
    const { closeDatabasePool } = await import('../../config/database.js');
    await closeDatabasePool();
  }

  appPromise = null;
};

export const uniqueValue = (prefix: string): string => {
  return `${prefix}-${randomUUID()}`;
};

export const queryRows = async <Row extends QueryResultRow>(
  queryText: string,
  values: unknown[] = [],
): Promise<Row[]> => {
  const result = await getTestPool().query<Row>(queryText, values);
  return result.rows;
};

export const queryRow = async <Row extends QueryResultRow>(
  queryText: string,
  values: unknown[] = [],
): Promise<Row | undefined> => {
  const rows = await queryRows<Row>(queryText, values);
  return rows[0];
};

export const deleteUserByUuid = async (uuid: string): Promise<void> => {
  await getTestPool().query('DELETE FROM users WHERE uuid = $1::uuid', [uuid]);
};

export const deleteUserByEmail = async (email: string): Promise<void> => {
  await getTestPool().query('DELETE FROM users WHERE email = $1', [email]);
};

export const deleteFeedbackByUuid = async (uuid: string): Promise<void> => {
  const client = await getTestPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('DELETE FROM notification WHERE feedback_uuid = $1::uuid', [uuid]);
    await client.query('DELETE FROM feedback WHERE uuid = $1::uuid', [uuid]);
    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error: unknown) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original database error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
};

export const deleteFeedbackByUuidOrRawAnswer = async (
  feedbackUuid: string | undefined,
  rawAnswer: string,
): Promise<void> => {
  const result = await getTestPool().query<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM feedback
     WHERE ($1 <> '' AND uuid::text = $1) OR raw_answer = $2`,
    [feedbackUuid ?? '', rawAnswer],
  );

  for (const row of result.rows) {
    await deleteFeedbackByUuid(row.uuid);
  }
};

export const expectDatabaseRow = async <Row extends QueryResultRow>(
  queryText: string,
  values: unknown[],
): Promise<Row> => {
  const row = await queryRow<Row>(queryText, values);
  if (!row) {
    throw new Error('Expected PostgreSQL read-back row was not found');
  }
  return row;
};
