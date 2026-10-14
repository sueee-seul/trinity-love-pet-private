import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolConfig } from 'pg';

const RDS_HOST_SUFFIX = '.rds.amazonaws.com';
const RDS_CA_BUNDLE_PATH = fileURLToPath(new URL('../../certs/global-bundle.pem', import.meta.url));

export const createPostgresConnectionConfig = (
  connectionString: string | undefined,
  nodeEnvironment: string | undefined,
): Pick<PoolConfig, 'connectionString' | 'ssl'> => {
  if (!connectionString) {
    return {
      connectionString,
      ssl: nodeEnvironment === 'production' ? { rejectUnauthorized: false } : undefined,
    } satisfies Pick<PoolConfig, 'connectionString' | 'ssl'>;
  }

  const databaseUrl = new URL(connectionString);
  if (!databaseUrl.hostname.toLowerCase().endsWith(RDS_HOST_SUFFIX)) {
    return {
      connectionString,
      ssl: nodeEnvironment === 'production' ? { rejectUnauthorized: false } : undefined,
    } satisfies Pick<PoolConfig, 'connectionString' | 'ssl'>;
  }

  // node-postgres lets sslmode/sslrootcert in the URL replace the ssl config object.
  databaseUrl.searchParams.delete('sslmode');
  databaseUrl.searchParams.delete('sslrootcert');

  return {
    connectionString: databaseUrl.toString(),
    ssl: {
      ca: readFileSync(RDS_CA_BUNDLE_PATH, 'utf8'),
      rejectUnauthorized: true,
    },
  } satisfies Pick<PoolConfig, 'connectionString' | 'ssl'>;
};
