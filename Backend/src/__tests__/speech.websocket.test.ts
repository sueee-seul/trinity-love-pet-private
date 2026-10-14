import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { attachSpeechWebSocket } from '../common/websocket/speech.websocket.js';
import type { SpeechServerEvent } from '../contracts/speech.contract.js';
import type { AuthenticatedUser } from '../services/auth.service.js';
import type { TranscribeStreamer, TranscriptSegment } from '../services/speech.streamer.js';

const parentUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000101',
  email: 'parent@example.test',
  name: 'Ava Mitchell',
  is_employee: false,
  is_pet_owner: true,
  employee_role: null,
  isUsingTemporaryPassword: false,
};

const ALLOWED_ORIGIN = 'http://localhost:5173';

const echoStreamer: TranscribeStreamer = {
  async *transcribe(audio): AsyncIterable<TranscriptSegment> {
    let bytes = 0;
    for await (const chunk of audio) {
      bytes += chunk.byteLength;
    }
    yield { text: `heard ${bytes} bytes`, isPartial: false };
  },
};

interface HandshakeResult {
  status: number | null;
  events: SpeechServerEvent[];
  closeCode: number | null;
}

/** Opens a socket, optionally runs a dictation, and reports how the server treated it. */
const connect = async (
  url: string,
  headers: Record<string, string>,
  script?: (socket: WebSocket) => void,
): Promise<HandshakeResult> => {
  const result: HandshakeResult = { status: null, events: [], closeCode: null };
  const socket = new WebSocket(url, { headers });

  await new Promise<void>((resolve) => {
    socket.on('unexpected-response', (_request, response) => {
      result.status = response.statusCode ?? null;
      socket.terminate();
      resolve();
    });
    socket.on('error', () => resolve());
    socket.on('open', () => {
      result.status = 101;
      script?.(socket);
    });
    socket.on('message', (data) => {
      result.events.push(JSON.parse(data.toString()) as SpeechServerEvent);
    });
    socket.on('close', (code) => {
      result.closeCode = code;
      resolve();
    });
  });

  return result;
};

describe('attachSpeechWebSocket', () => {
  let server: Server;
  let url: string;
  const authenticate = vi.fn<(request: unknown) => Promise<AuthenticatedUser | null>>();

  beforeEach(async () => {
    authenticate.mockReset();
    server = createServer((_request, response) => {
      response.statusCode = 404;
      response.end();
    });
    attachSpeechWebSocket({
      server,
      allowedOrigins: [ALLOWED_ORIGIN],
      streamer: echoStreamer,
      authenticate,
      maxSessionsPerUser: 1,
      log: () => undefined,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/api/speech/stream`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects a handshake without a valid session', async () => {
    authenticate.mockResolvedValue(null);

    const result = await connect(url, { Origin: ALLOWED_ORIGIN });

    expect(result.status).toBe(401);
  });

  it('rejects a handshake from another origin even with a valid session', async () => {
    authenticate.mockResolvedValue(parentUser);

    const result = await connect(url, { Origin: 'https://evil.example' });

    expect(result.status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects any other upgrade path', async () => {
    authenticate.mockResolvedValue(parentUser);

    const result = await connect(url.replace('/api/speech/stream', '/api/other'), {
      Origin: ALLOWED_ORIGIN,
    });

    expect(result.status).toBe(404);
  });

  it('runs a dictation for a signed-in user', async () => {
    authenticate.mockResolvedValue(parentUser);

    const result = await connect(
      url,
      { Origin: ALLOWED_ORIGIN, Cookie: 'wagstay_session=token' },
      (socket) => {
        socket.send(JSON.stringify({ type: 'start', sampleRate: 16000 }));
        socket.send(new Uint8Array(3200));
        socket.send(new Uint8Array(1600));
        socket.send(JSON.stringify({ type: 'stop' }));
      },
    );

    expect(result.status).toBe(101);
    expect(result.events[0]).toMatchObject({ type: 'ready', maxDurationMs: 120_000 });
    expect(result.events).toContainEqual({
      type: 'transcript',
      text: 'heard 4800 bytes',
      isPartial: false,
    });
    expect(result.events.at(-1)).toEqual({
      type: 'end',
      transcript: 'heard 4800 bytes',
      reason: 'stopped',
    });
    expect(result.closeCode).toBe(1000);
  });

  it('limits concurrent dictations per account', async () => {
    authenticate.mockResolvedValue(parentUser);

    const first = new WebSocket(url, { headers: { Origin: ALLOWED_ORIGIN } });
    await new Promise<void>((resolve) => first.on('open', resolve));

    const second = await connect(url, { Origin: ALLOWED_ORIGIN });
    expect(second.status).toBe(429);

    first.close();
    await new Promise<void>((resolve) => first.on('close', () => resolve()));
  });
});

describe('attachSpeechWebSocket with guests allowed', () => {
  let server: Server;
  let url: string;

  const dictate = (socket: WebSocket): void => {
    socket.send(JSON.stringify({ type: 'start', sampleRate: 16000 }));
    socket.send(new Uint8Array(3200));
    socket.send(JSON.stringify({ type: 'stop' }));
  };

  beforeEach(async () => {
    server = createServer((_request, response) => {
      response.statusCode = 404;
      response.end();
    });
    attachSpeechWebSocket({
      server,
      allowedOrigins: [ALLOWED_ORIGIN],
      streamer: echoStreamer,
      authenticate: async () => null,
      allowGuests: true,
      maxSessionsPerGuest: 1,
      guestStartsPerHour: 2,
      log: () => undefined,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/api/speech/stream`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('runs a dictation for a visitor without a session', async () => {
    const result = await connect(url, { Origin: ALLOWED_ORIGIN }, dictate);

    expect(result.status).toBe(101);
    expect(result.events.at(-1)).toEqual({
      type: 'end',
      transcript: 'heard 3200 bytes',
      reason: 'stopped',
    });
  });

  it('allows one concurrent dictation per guest address', async () => {
    const first = new WebSocket(url, { headers: { Origin: ALLOWED_ORIGIN } });
    await new Promise<void>((resolve) => first.on('open', resolve));

    const second = await connect(url, { Origin: ALLOWED_ORIGIN });
    expect(second.status).toBe(429);

    first.close();
    await new Promise<void>((resolve) => first.on('close', () => resolve()));
  });

  it('refuses a guest once the hourly start budget is spent', async () => {
    await connect(url, { Origin: ALLOWED_ORIGIN }, dictate);
    await connect(url, { Origin: ALLOWED_ORIGIN }, dictate);

    const third = await connect(url, { Origin: ALLOWED_ORIGIN }, dictate);

    expect(third.status).toBe(429);
  });
});
