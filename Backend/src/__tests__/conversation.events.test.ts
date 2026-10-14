import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONVERSATION_SSE_HEARTBEAT_INTERVAL_MS,
  publishInquiryCreated,
  streamInquiryCreatedEvents,
} from '../services/conversation.events.js';

interface MockResponse {
  headers: Record<string, string>;
  chunks: string[];
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
      response.writableEnded = true;
    }),
    writableEnded: false,
  };
  return response;
};

const createRequest = (): { request: Request; close: () => void } => {
  const emitter = new EventEmitter();
  return {
    request: emitter as unknown as Request,
    close: () => emitter.emit('close'),
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('streamInquiryCreatedEvents', () => {
  it('writes SSE headers, frames every inquiry-created broadcast, and sends heartbeats', () => {
    vi.useFakeTimers();
    const { request, close } = createRequest();
    const response = createResponse();

    streamInquiryCreatedEvents(request, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.headers).toEqual({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(response.flushHeaders).toHaveBeenCalledOnce();

    publishInquiryCreated('conv-123');
    expect(response.chunks).toEqual([
      'event: inquiry-created\ndata: {"type":"inquiry-created","conversationId":"conv-123"}\n\n',
    ]);

    vi.advanceTimersByTime(CONVERSATION_SSE_HEARTBEAT_INTERVAL_MS);
    expect(response.chunks).toContain(': heartbeat\n\n');

    close();
    publishInquiryCreated('conv-456');
    vi.advanceTimersByTime(CONVERSATION_SSE_HEARTBEAT_INTERVAL_MS);
    expect(response.chunks).not.toContain(
      'event: inquiry-created\ndata: {"type":"inquiry-created","conversationId":"conv-456"}\n\n',
    );
    expect(response.end).not.toHaveBeenCalled();
  });

  it('broadcasts to every connected stream, unscoped to any one conversation', () => {
    const { request: requestA } = createRequest();
    const { request: requestB } = createRequest();
    const responseA = createResponse();
    const responseB = createResponse();

    streamInquiryCreatedEvents(requestA, responseA as unknown as Response);
    streamInquiryCreatedEvents(requestB, responseB as unknown as Response);

    publishInquiryCreated('conv-shared');

    expect(responseA.chunks).toEqual([
      'event: inquiry-created\ndata: {"type":"inquiry-created","conversationId":"conv-shared"}\n\n',
    ]);
    expect(responseB.chunks).toEqual(responseA.chunks);
  });
});
