import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_REVIEW_SSE_HEARTBEAT_INTERVAL_MS,
  streamPublicGoogleReviewEvents,
} from '../controllers/google.review.events.controller.js';
import { publishGoogleReviewEvent } from '../services/google.review.events.js';

interface MockResponse {
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  statusCode: number | undefined;
  status: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  flushHeaders: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  writableEnded: boolean;
}

const createResponse = (): MockResponse => {
  const response: MockResponse = {
    headers: {},
    chunks: [],
    ended: false,
    statusCode: undefined,
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name] = value;
    }),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      response.chunks.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      response.ended = true;
      response.writableEnded = true;
    }),
    writableEnded: false,
  };
  return response;
};

const createRequest = (placeSlug: string): { request: Request; close: () => void } => {
  const emitter = new EventEmitter();
  return {
    request: Object.assign(emitter, { query: { placeSlug } }) as unknown as Request,
    close: () => emitter.emit('close'),
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Google review SSE controller', () => {
  it('writes SSE headers, frames invalidation events, and sends heartbeats', () => {
    vi.useFakeTimers();
    const { request, close } = createRequest('PetHouse');
    const response = createResponse();
    const next = vi.fn();

    void streamPublicGoogleReviewEvents(request, response as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.headers).toEqual({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(response.flushHeaders).toHaveBeenCalledOnce();

    publishGoogleReviewEvent({ target: 'public', placeSlug: 'PetHouse', changeType: 'created' });
    expect(response.chunks).toEqual([
      'event: google-reviews-updated\ndata: {"type":"google-reviews-updated","placeSlug":"PetHouse","changeType":"created"}\n\n',
    ]);

    vi.advanceTimersByTime(GOOGLE_REVIEW_SSE_HEARTBEAT_INTERVAL_MS);
    expect(response.chunks).toContain(': heartbeat\n\n');

    close();
    publishGoogleReviewEvent({ target: 'public', placeSlug: 'PetHouse', changeType: 'deleted' });
    vi.advanceTimersByTime(GOOGLE_REVIEW_SSE_HEARTBEAT_INTERVAL_MS);
    expect(response.chunks).not.toContain(
      'event: google-reviews-updated\ndata: {"type":"google-reviews-updated","placeSlug":"PetHouse","changeType":"deleted"}\n\n',
    );
    expect(response.end).not.toHaveBeenCalled();
  });

  it('passes invalid place slugs to the existing error boundary before opening a stream', () => {
    const { request } = createRequest('not a slug');
    const response = createResponse();
    const next = vi.fn();

    void streamPublicGoogleReviewEvents(request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.flushHeaders).not.toHaveBeenCalled();
  });
});
