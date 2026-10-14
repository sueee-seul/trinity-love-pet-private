import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimit, resetRateLimits } from '../common/middlewares/rate-limit.middleware.js';

/**
 * The budget is what makes an open, model-backed endpoint affordable, so it is asserted rather than
 * assumed. An off-by-one here is the difference between a ceiling and no ceiling.
 */

interface MockResponse {
  statusCode: number | undefined;
  body: unknown;
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
}

const makeResponse = (): Response & { statusCode?: number; body?: unknown } => {
  const response: MockResponse = {
    statusCode: undefined,
    body: undefined,
    headers: {},
    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    },
    status(code: number): MockResponse {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown): MockResponse {
      this.body = payload;
      return this;
    },
  };
  return response as unknown as Response & { statusCode?: number; body?: unknown };
};

const request = (ip: string, userId?: string): Request =>
  ({ ip, user: userId ? { id: userId } : undefined }) as unknown as Request;

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it('lets exactly the allowed number through, then refuses', () => {
    const limiter = rateLimit({ name: 'test', limit: 3, windowMs: 60_000 });
    const next = vi.fn() as unknown as NextFunction;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      limiter(request('1.1.1.1'), makeResponse(), next);
    }
    expect(next).toHaveBeenCalledTimes(3);

    const blocked = makeResponse();
    limiter(request('1.1.1.1'), blocked, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(blocked.statusCode).toBe(429);
  });

  it('tells a refused client when to come back', () => {
    const limiter = rateLimit({ name: 'test', limit: 1, windowMs: 60_000 });
    const next = vi.fn() as unknown as NextFunction;
    limiter(request('1.1.1.1'), makeResponse(), next);

    const blocked = makeResponse();
    limiter(request('1.1.1.1'), blocked, next);

    expect((blocked as unknown as { headers: Record<string, string> }).headers['Retry-After']).toBe(
      '60',
    );
  });

  it('budgets each client separately, so one heavy user cannot lock everyone out', () => {
    const limiter = rateLimit({ name: 'test', limit: 1, windowMs: 60_000 });
    const next = vi.fn() as unknown as NextFunction;

    limiter(request('1.1.1.1'), makeResponse(), next);
    limiter(request('1.1.1.1'), makeResponse(), next);
    limiter(request('2.2.2.2'), makeResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  // A signed-in visitor is budgeted as themselves, not as whatever address they share with others.
  it('budgets a signed-in visitor by their account', () => {
    const limiter = rateLimit({ name: 'test', limit: 1, windowMs: 60_000 });
    const next = vi.fn() as unknown as NextFunction;

    limiter(request('1.1.1.1', 'user-a'), makeResponse(), next);
    limiter(request('1.1.1.1', 'user-b'), makeResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('keeps separate budgets for separate routes', () => {
    const next = vi.fn() as unknown as NextFunction;
    const one = rateLimit({ name: 'route-one', limit: 1, windowMs: 60_000 });
    const two = rateLimit({ name: 'route-two', limit: 1, windowMs: 60_000 });

    one(request('1.1.1.1'), makeResponse(), next);
    two(request('1.1.1.1'), makeResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('opens the window again once it has passed', () => {
    vi.useFakeTimers();
    const limiter = rateLimit({ name: 'test', limit: 1, windowMs: 1000 });
    const next = vi.fn() as unknown as NextFunction;

    limiter(request('1.1.1.1'), makeResponse(), next);
    limiter(request('1.1.1.1'), makeResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    limiter(request('1.1.1.1'), makeResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });
  it('keeps a separate budget for each key the route names, whatever the address', () => {
    const limiter = rateLimit({
      name: 'per-email',
      limit: 1,
      windowMs: 60_000,
      keyOf: (req) => (req as unknown as { body: { email?: string } }).body.email,
    });
    const next = vi.fn() as unknown as NextFunction;
    const withEmail = (ip: string, email?: string): Request =>
      ({ ip, body: { email } }) as unknown as Request;

    limiter(withEmail('1.1.1.1', 'a@example.test'), makeResponse(), next);
    limiter(withEmail('2.2.2.2', 'b@example.test'), makeResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);

    const sameAccountNewAddress = makeResponse();
    limiter(withEmail('3.3.3.3', 'a@example.test'), sameAccountNewAddress, next);
    expect(sameAccountNewAddress.statusCode).toBe(429);

    // No email to count against: the route's own validation answers instead.
    limiter(withEmail('3.3.3.3'), makeResponse(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });
});
