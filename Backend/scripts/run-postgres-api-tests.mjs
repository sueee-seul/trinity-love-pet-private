import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import {
  POSTGRES_API_TEST_LOCK_KEY,
  validatePostgresApiTestDatabase,
} from './postgres-api-test-preflight.mjs';

// This npm script always wants the strict check - a missing TEST_DATABASE_URL
// should fail loudly, not silently skip the suite. Setting it here (rather
// than as a `POSTGRES_API_TEST_REQUIRED=1` prefix in package.json) keeps the
// script runnable from cmd.exe/PowerShell, which don't understand that
// inline-env-var shell syntax.
process.env.POSTGRES_API_TEST_REQUIRED ??= '1';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL API integration tests');
}

if (process.env.POSTGRESQL_URL && process.env.POSTGRESQL_URL === testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be isolated from POSTGRESQL_URL');
}

const vitestEntrypoint = path.resolve('node_modules/vitest/vitest.mjs');
const client = new Client({
  connectionString: testDatabaseUrl,
  connectionTimeoutMillis: 5_000,
});

let transactionStarted = false;
let exitCode = 1;

try {
  await client.connect();
  await client.query('BEGIN');
  transactionStarted = true;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [POSTGRES_API_TEST_LOCK_KEY]);
  await client.query("SET LOCAL statement_timeout = '10000'");

  const schema = await validatePostgresApiTestDatabase(client);
  console.log(
    `PostgreSQL API test preflight passed (${schema.tableCount} tables, ${schema.columnCount} columns).`,
  );

  const result = spawnSync(
    process.execPath,
    [
      vitestEntrypoint,
      'run',
      '--config',
      'vitest.postgres.config.ts',
      'src/__tests__/api.postgres.auth-feedback.test.ts',
      'src/__tests__/api.postgres.admin-feedback.test.ts',
      'src/__tests__/api.postgres.admin-google-review.test.ts',
      'src/__tests__/api.postgres.staff.test.ts',
      'src/__tests__/api.postgres.pet-assignment.test.ts',
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(`PostgreSQL API test runner failed to start: ${result.error.message}`);
  }
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PostgreSQL API test preflight failed');
} finally {
  if (transactionStarted) {
    await client.query('ROLLBACK').catch(() => undefined);
  }
  await client.end().catch(() => undefined);
}

process.exitCode = exitCode;
