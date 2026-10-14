import { afterEach, describe, expect, it } from 'vitest';
import { getDatabaseConnectionString } from '../config/database.js';

const originalPostgresqlUrl = process.env.POSTGRESQL_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalPostgresqlUrl === undefined) {
    delete process.env.POSTGRESQL_URL;
  } else {
    process.env.POSTGRESQL_URL = originalPostgresqlUrl;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe('database connection configuration', () => {
  it('uses POSTGRESQL_URL for the application connection', () => {
    process.env.POSTGRESQL_URL = 'postgresql://neon.example/app';
    process.env.DATABASE_URL = 'postgresql://legacy.example/app';

    expect(getDatabaseConnectionString()).toBe('postgresql://neon.example/app');
  });

  it('does not fall back to DATABASE_URL', () => {
    delete process.env.POSTGRESQL_URL;
    process.env.DATABASE_URL = 'postgresql://localhost/app';

    expect(getDatabaseConnectionString()).toBeUndefined();
  });

  it('returns undefined when neither connection variable is configured', () => {
    delete process.env.POSTGRESQL_URL;
    delete process.env.DATABASE_URL;

    expect(getDatabaseConnectionString()).toBeUndefined();
  });
});
