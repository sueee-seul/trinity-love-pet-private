import { describe, expect, it } from 'vitest';
import { createPostgresConnectionConfig } from '../config/postgres.connection.config.js';

describe('PostgreSQL connection TLS configuration', () => {
  it('verifies RDS certificates with the AWS CA bundle and removes conflicting URL SSL options', () => {
    const config = createPostgresConnectionConfig(
      'postgresql://app:password@db.example.ap-southeast-2.rds.amazonaws.com:5432/wagstay?sslmode=require&sslrootcert=old.pem',
      'development',
    );
    const databaseUrl = new URL(config.connectionString ?? '');

    expect(databaseUrl.hostname).toBe('db.example.ap-southeast-2.rds.amazonaws.com');
    expect(databaseUrl.pathname).toBe('/wagstay');
    expect(databaseUrl.searchParams.has('sslmode')).toBe(false);
    expect(databaseUrl.searchParams.has('sslrootcert')).toBe(false);
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(config.ssl && typeof config.ssl === 'object' && config.ssl.ca).toContain(
      '-----BEGIN CERTIFICATE-----',
    );
  });

  it('preserves local PostgreSQL SSL behavior outside RDS', () => {
    const config = createPostgresConnectionConfig(
      'postgresql://app:password@127.0.0.1:5433/wagstay',
      'development',
    );

    expect(config.connectionString).toBe('postgresql://app:password@127.0.0.1:5433/wagstay');
    expect(config.ssl).toBeUndefined();
  });
});
