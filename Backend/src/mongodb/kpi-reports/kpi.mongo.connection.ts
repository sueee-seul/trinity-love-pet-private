import mongoose, { type Connection } from 'mongoose';

/*
 * The KPI reports database (daily summaries, report logs, alert logs) is configured only through
 * KPI_MONGO_URI. It uses its own mongoose connection and never touches the default connection
 * (MONGO_URI) used by other features.
 */
const KPI_MONGO_URI_ENVIRONMENT_VARIABLE = 'KPI_MONGO_URI';

let kpiConnectionPromise: Promise<Connection> | undefined;

/** True when KPI_MONGO_URI is set; KPI reports stay off without it. */
export const isKpiMongoConfigured = (): boolean =>
  Boolean(process.env[KPI_MONGO_URI_ENVIRONMENT_VARIABLE]?.trim());

/** Opens the KPI reports connection once and returns it on later calls. */
export const getKpiMongoConnection = async (): Promise<Connection> => {
  const connectionString = process.env[KPI_MONGO_URI_ENVIRONMENT_VARIABLE]?.trim();
  if (!connectionString) {
    throw new Error(`${KPI_MONGO_URI_ENVIRONMENT_VARIABLE} must be configured.`);
  }
  if (!kpiConnectionPromise) {
    kpiConnectionPromise = mongoose
      .createConnection(connectionString)
      .asPromise()
      .catch((error: unknown) => {
        kpiConnectionPromise = undefined;
        throw error;
      });
  }
  return kpiConnectionPromise;
};

/** Closes the KPI reports connection if it was opened. */
export const closeKpiMongoConnection = async (): Promise<void> => {
  if (!kpiConnectionPromise) {
    return;
  }
  const connection = await kpiConnectionPromise;
  kpiConnectionPromise = undefined;
  await connection.close();
};
