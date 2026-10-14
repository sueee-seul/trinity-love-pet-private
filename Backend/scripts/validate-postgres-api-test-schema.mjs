import { Client } from 'pg';
import { validatePostgresApiTestDatabase } from './postgres-api-test-preflight.mjs';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error('TEST_DATABASE_URL is required for PostgreSQL API test schema validation');
  process.exitCode = 1;
} else {
  const client = new Client({
    connectionString: testDatabaseUrl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });

  try {
    await client.connect();
    const result = await validatePostgresApiTestDatabase(client);
    console.log(
      `PostgreSQL API test schema matches Backend/database/neon.sql (${result.tableCount} tables, ${result.columnCount} columns).`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'PostgreSQL API test schema validation failed',
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
