/**
 * A request the server refused, with its status and the body it sent. It has a module of its own
 * so code that only reads errors does not load the whole booking client.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
