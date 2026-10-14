import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoConfigurationError, MongoConnectionError } from './mongodb.errors.js';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDirectory, '../../../.env.local') });
dotenv.config({ path: path.resolve(configDirectory, '../../.env') });
dotenv.config();

const MONGO_URI_ENVIRONMENT_VARIABLE = 'MONGO_URI';
const MONGODB_PROTOCOLS = new Set(['mongodb:', 'mongodb+srv:']);

/** The Mongo database connection is configured only through MONGO_URI. */
export const getMongoConnectionString = (): string | undefined => {
  const connectionString = process.env[MONGO_URI_ENVIRONMENT_VARIABLE]?.trim();
  return connectionString || undefined;
};

const readMongoConnectionString = (): string => {
  const connectionString = getMongoConnectionString();
  if (!connectionString) {
    throw new MongoConfigurationError(`${MONGO_URI_ENVIRONMENT_VARIABLE} must be configured.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new MongoConfigurationError(
      `${MONGO_URI_ENVIRONMENT_VARIABLE} is not a valid MongoDB connection string.`,
    );
  }

  if (!MONGODB_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new MongoConfigurationError(
      `${MONGO_URI_ENVIRONMENT_VARIABLE} must use a supported MongoDB protocol.`,
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  } catch {
    throw new MongoConfigurationError(
      `${MONGO_URI_ENVIRONMENT_VARIABLE} contains an invalid database path.`,
    );
  }

  if (!databaseName || databaseName.includes('/')) {
    throw new MongoConfigurationError(
      `${MONGO_URI_ENVIRONMENT_VARIABLE} must include a database name after the host.`,
    );
  }

  return connectionString;
};

let mongoConnectionPromise: Promise<typeof mongoose> | undefined;

export const connectToMongoDB = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!mongoConnectionPromise) {
    const connectionString = readMongoConnectionString();
    mongoConnectionPromise = mongoose.connect(connectionString).catch(() => {
      mongoConnectionPromise = undefined;
      throw new MongoConnectionError('The MongoDB connection failed.');
    });
  }

  return mongoConnectionPromise;
};

export const closeMongoConnection = async (): Promise<void> => {
  mongoConnectionPromise = undefined;
  await mongoose.connection.close();
};

export async function checkMongoConnection(): Promise<boolean> {
  await connectToMongoDB();
  return mongoose.connection.readyState === 1;
}

export { mongoose };
