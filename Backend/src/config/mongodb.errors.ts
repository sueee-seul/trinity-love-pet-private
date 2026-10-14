export class MongoConfigurationError extends Error {
  public readonly code = 'MONGODB_CONFIGURATION_INVALID';

  public constructor(message: string) {
    super(message);
    this.name = 'MongoConfigurationError';
    Object.setPrototypeOf(this, MongoConfigurationError.prototype);
  }
}

export class MongoConnectionError extends Error {
  public readonly code = 'MONGODB_CONNECTION_FAILED';

  public constructor(message: string) {
    super(message);
    this.name = 'MongoConnectionError';
    Object.setPrototypeOf(this, MongoConnectionError.prototype);
  }
}
