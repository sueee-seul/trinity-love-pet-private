import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mongoMocks = vi.hoisted(() => {
  const connection = {
    readyState: 0,
    close: vi.fn(),
  };
  const mongoose = {
    connect: vi.fn(),
    connection,
  };
  return { connection, mongoose };
});

vi.mock('mongoose', () => ({ default: mongoMocks.mongoose }));

import {
  checkMongoConnection,
  closeMongoConnection,
  connectToMongoDB,
  getMongoConnectionString,
} from '../config/mongodb.js';
import { MongoConfigurationError, MongoConnectionError } from '../config/mongodb.errors.js';

const originalMongoUri = process.env.MONGO_URI;
const originalLegacyMongoUrl = process.env.MONGODB_URL;

beforeEach(async () => {
  await closeMongoConnection();
  vi.clearAllMocks();
  mongoMocks.connection.readyState = 0;
  mongoMocks.connection.close.mockImplementation(async () => {
    mongoMocks.connection.readyState = 0;
  });
  mongoMocks.mongoose.connect.mockImplementation(async () => {
    mongoMocks.connection.readyState = 1;
    return mongoMocks.mongoose;
  });
  process.env.MONGO_URI =
    '  mongodb+srv://agent-user:agent-password@cluster.example/tropical_love_pet_agent  ';
  delete process.env.MONGODB_URL;
});

afterEach(async () => {
  await closeMongoConnection();
  if (originalMongoUri === undefined) {
    delete process.env.MONGO_URI;
  } else {
    process.env.MONGO_URI = originalMongoUri;
  }

  if (originalLegacyMongoUrl === undefined) {
    delete process.env.MONGODB_URL;
  } else {
    process.env.MONGODB_URL = originalLegacyMongoUrl;
  }
});

describe('shared MongoDB Mongoose connection', () => {
  it('reads and trims the single MONGO_URI configuration', async () => {
    expect(getMongoConnectionString()).toBe(
      'mongodb+srv://agent-user:agent-password@cluster.example/tropical_love_pet_agent',
    );

    await connectToMongoDB();

    expect(mongoMocks.mongoose.connect).toHaveBeenCalledWith(
      'mongodb+srv://agent-user:agent-password@cluster.example/tropical_love_pet_agent',
    );
  });

  it('shares one Mongoose connection attempt for concurrent callers', async () => {
    const first = connectToMongoDB();
    const second = connectToMongoDB();
    const [firstConnection, secondConnection] = await Promise.all([first, second]);

    expect(firstConnection).toBe(secondConnection);
    expect(mongoMocks.mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to the legacy MONGODB_URL variable', async () => {
    delete process.env.MONGO_URI;
    process.env.MONGODB_URL =
      'mongodb+srv://legacy-user:legacy-password@cluster.example/legacy_database';

    await expect(connectToMongoDB()).rejects.toBeInstanceOf(MongoConfigurationError);
    expect(mongoMocks.mongoose.connect).not.toHaveBeenCalled();
  });

  it('rejects unsupported protocols and URIs without a database name', async () => {
    process.env.MONGO_URI = 'https://cluster.example/tropical_love_pet_agent';
    await expect(connectToMongoDB()).rejects.toBeInstanceOf(MongoConfigurationError);

    process.env.MONGO_URI = 'mongodb+srv://agent-user:agent-password@cluster.example/';
    await expect(connectToMongoDB()).rejects.toBeInstanceOf(MongoConfigurationError);
    expect(mongoMocks.mongoose.connect).not.toHaveBeenCalled();
  });

  it('maps connection failures to a safe shared error', async () => {
    mongoMocks.mongoose.connect.mockRejectedValueOnce(new Error('credential or network detail'));

    await expect(connectToMongoDB()).rejects.toMatchObject({
      code: 'MONGODB_CONNECTION_FAILED',
      message: 'The MongoDB connection failed.',
    } satisfies Partial<MongoConnectionError>);
  });

  it('uses the already-open shared connection for health checks', async () => {
    await connectToMongoDB();
    vi.clearAllMocks();

    await expect(checkMongoConnection()).resolves.toBe(true);
    expect(mongoMocks.mongoose.connect).not.toHaveBeenCalled();
  });

  it('closes the shared Mongoose connection and allows a later retry', async () => {
    await connectToMongoDB();
    await closeMongoConnection();

    expect(mongoMocks.connection.close).toHaveBeenCalledTimes(1);
    expect(mongoMocks.connection.readyState).toBe(0);

    await connectToMongoDB();
    expect(mongoMocks.mongoose.connect).toHaveBeenCalledTimes(2);
  });
});
