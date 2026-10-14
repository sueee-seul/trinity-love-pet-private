import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SpeechStreamClient,
  SpeechStreamError,
  type SpeechStreamClientHandlers,
} from '../speechStreamClient';

/** Just enough of the WebSocket surface for the client, driven by the test. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = 0;
  binaryType: BinaryType = 'blob';
  sent: unknown[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: unknown): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({} as Event);
  }

  receive(event: object): void {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
  }

  fail(): void {
    this.onerror?.({} as Event);
  }
}

const createHandlers = (): SpeechStreamClientHandlers => ({
  onTranscript: vi.fn(),
  onEnd: vi.fn(),
  onError: vi.fn(),
});

const createClient = (
  handlers: SpeechStreamClientHandlers,
  batchSamples?: number,
): SpeechStreamClient =>
  new SpeechStreamClient({
    url: 'ws://api.test/api/speech/stream',
    handlers,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    ...(batchSamples === undefined ? {} : { batchSamples }),
  });

const latestSocket = (): FakeWebSocket => {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) {
    throw new Error('No socket was opened');
  }
  return socket;
};

describe('SpeechStreamClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it('sends start on open and resolves once the server is ready', async () => {
    const client = createClient(createHandlers());

    const connecting = client.connect();
    const socket = latestSocket();
    expect(socket.url).toBe('ws://api.test/api/speech/stream');
    expect(socket.binaryType).toBe('arraybuffer');

    socket.open();
    expect(socket.sent).toEqual([JSON.stringify({ type: 'start', sampleRate: 16000 })]);

    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await expect(connecting).resolves.toBeUndefined();
  });

  it('rejects when the server refuses the session before it is ready', async () => {
    const client = createClient(createHandlers());

    const connecting = client.connect();
    latestSocket().open();
    latestSocket().receive({
      type: 'error',
      code: 'not_configured',
      message: 'Speech service is not configured',
    });

    await expect(connecting).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('rejects with a connection error when the socket cannot open', async () => {
    const client = createClient(createHandlers());

    const connecting = client.connect();
    latestSocket().fail();
    latestSocket().close();

    await expect(connecting).rejects.toBeInstanceOf(SpeechStreamError);
    await expect(connecting).rejects.toMatchObject({ code: 'connection' });
  });

  it('batches audio into frames of the configured size and flushes the rest on stop', async () => {
    const client = createClient(createHandlers(), 4);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;
    socket.sent = [];

    client.sendAudio(new Int16Array([1, 2]));
    expect(socket.sent).toHaveLength(0);
    client.sendAudio(new Int16Array([3, 4]));
    expect(socket.sent).toHaveLength(1);
    expect(Array.from(new Int16Array(socket.sent[0] as ArrayBuffer))).toEqual([1, 2, 3, 4]);

    client.sendAudio(new Int16Array([5]));
    client.stop();
    expect(Array.from(new Int16Array(socket.sent[1] as ArrayBuffer))).toEqual([5]);
    expect(socket.sent[2]).toBe(JSON.stringify({ type: 'stop' }));
  });

  it('forwards transcript and end events to the handlers', async () => {
    const handlers = createHandlers();
    const client = createClient(handlers);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;

    socket.receive({ type: 'transcript', text: 'Bobo is', isPartial: true });
    socket.receive({
      type: 'transcript',
      text: 'Bobo is a dog.',
      isPartial: false,
      languageCode: 'en-US',
    });
    socket.receive({ type: 'end', transcript: 'Bobo is a dog.', reason: 'stopped' });
    socket.close();

    expect(handlers.onTranscript).toHaveBeenNthCalledWith(1, { text: 'Bobo is', isPartial: true });
    expect(handlers.onTranscript).toHaveBeenNthCalledWith(2, {
      text: 'Bobo is a dog.',
      isPartial: false,
      languageCode: 'en-US',
    });
    expect(handlers.onEnd).toHaveBeenCalledWith('Bobo is a dog.', 'stopped');
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('reports a server error after ready through the handler, once', async () => {
    const handlers = createHandlers();
    const client = createClient(handlers);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;

    socket.receive({
      type: 'error',
      code: 'provider_unavailable',
      message: 'Speech could not be transcribed',
    });
    socket.close();

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'provider_unavailable' }),
    );
  });

  it('treats a close without end as a connection failure', async () => {
    const handlers = createHandlers();
    const client = createClient(handlers);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;

    socket.close();

    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'connection' }));
  });

  it('ignores frames it does not understand', async () => {
    const handlers = createHandlers();
    const client = createClient(handlers);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;

    socket.onmessage?.({ data: 'not json' } as MessageEvent);
    socket.receive({ type: 'transcript' });
    socket.receive({ type: 'mystery' });

    expect(handlers.onTranscript).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('abort closes the socket without reporting an error', async () => {
    const handlers = createHandlers();
    const client = createClient(handlers);
    const connecting = client.connect();
    const socket = latestSocket();
    socket.open();
    socket.receive({ type: 'ready', sessionId: 's1', maxDurationMs: 120000 });
    await connecting;

    client.abort();

    expect(socket.readyState).toBe(3);
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});
