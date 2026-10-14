import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeechServerEvent } from '../contracts/speech.contract.js';
import {
  SpeechStreamSession,
  type SpeechSessionSocket,
} from '../services/speech.stream.session.js';
import {
  SpeechProviderError,
  type TranscribeStreamer,
  type TranscriptSegment,
} from '../services/speech.streamer.js';

interface FakeSocket extends SpeechSessionSocket {
  events: SpeechServerEvent[];
  closed: { code: number; reason: string } | null;
}

const createFakeSocket = (): FakeSocket => {
  const socket: FakeSocket = {
    events: [],
    closed: null,
    send: (event): void => {
      socket.events.push(event);
    },
    close: (code, reason): void => {
      socket.closed = { code, reason };
    },
  };
  return socket;
};

/**
 * A streamer that records every audio byte it is given and, once the audio ends, replays a script
 * of segments. `segmentsPerChunk` lets a test interleave partial results with the audio.
 */
const createScriptedStreamer = (
  finalSegments: TranscriptSegment[],
  segmentsPerChunk: TranscriptSegment[] = [],
): TranscribeStreamer & { received: number[]; sessionIds: string[] } => {
  const received: number[] = [];
  const sessionIds: string[] = [];
  return {
    received,
    sessionIds,
    async *transcribe(audio, { sessionId }): AsyncIterable<TranscriptSegment> {
      sessionIds.push(sessionId);
      for await (const chunk of audio) {
        received.push(...chunk);
        yield* segmentsPerChunk;
      }
      yield* finalSegments;
    },
  };
};

const encode = (value: object): string => JSON.stringify(value);

const flush = async (): Promise<void> => {
  // Segments travel through two async generators and a for-await loop; each hop costs a few
  // microtask turns, and fake timers rule out waiting on a macrotask instead.
  for (let index = 0; index < 64; index += 1) {
    await Promise.resolve();
  }
};

describe('SpeechStreamSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('relays audio to the provider and ends with the committed transcript', async () => {
    const streamer = createScriptedStreamer(
      [{ text: 'Bobo is a Shiba Inu', isPartial: false, languageCode: 'en-US' }],
      [{ text: 'Bobo is', isPartial: true }],
    );
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer, socket, sessionId: 'session-1' });

    session.handleMessage(encode({ type: 'start', sampleRate: 16000 }), false);
    session.handleMessage(new Uint8Array([1, 2, 3]), true);
    session.handleMessage(new Uint8Array([4, 5]), true);
    await flush();
    session.handleMessage(encode({ type: 'stop' }), false);
    await flush();

    expect(streamer.received).toEqual([1, 2, 3, 4, 5]);
    expect(streamer.sessionIds).toEqual(['session-1']);
    expect(socket.events[0]).toEqual({
      type: 'ready',
      sessionId: 'session-1',
      maxDurationMs: 120_000,
    });
    expect(socket.events).toContainEqual({ type: 'transcript', text: 'Bobo is', isPartial: true });
    expect(socket.events).toContainEqual({
      type: 'transcript',
      text: 'Bobo is a Shiba Inu',
      isPartial: false,
      languageCode: 'en-US',
    });
    expect(socket.events.at(-1)).toEqual({
      type: 'end',
      transcript: 'Bobo is a Shiba Inu',
      reason: 'stopped',
    });
    expect(socket.closed).toEqual({ code: 1000, reason: 'end' });
  });

  it('joins several final segments in order and leaves partials out of the transcript', async () => {
    const streamer = createScriptedStreamer([
      { text: 'Allergic to beef.', isPartial: false },
      { text: 'Vet is Dr', isPartial: true },
      { text: 'Vet is Dr Wong.', isPartial: false },
    ]);
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer, socket });

    session.handleMessage(encode({ type: 'start' }), false);
    session.handleMessage(encode({ type: 'stop' }), false);
    await flush();

    expect(socket.events.at(-1)).toEqual({
      type: 'end',
      transcript: 'Allergic to beef. Vet is Dr Wong.',
      reason: 'stopped',
    });
  });

  it('rejects audio that arrives before start', () => {
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer: createScriptedStreamer([]), socket });

    session.handleMessage(new Uint8Array([1]), true);

    expect(socket.events).toEqual([
      { type: 'error', code: 'protocol', message: 'Audio was sent before start' },
    ]);
    expect(socket.closed).toEqual({ code: 1008, reason: 'protocol' });
  });

  it('rejects malformed and unknown control messages', () => {
    const malformed = createFakeSocket();
    new SpeechStreamSession({
      streamer: createScriptedStreamer([]),
      socket: malformed,
    }).handleMessage('{not json', false);
    expect(malformed.events[0]).toMatchObject({ type: 'error', code: 'protocol' });

    const unknown = createFakeSocket();
    new SpeechStreamSession({
      streamer: createScriptedStreamer([]),
      socket: unknown,
    }).handleMessage(encode({ type: 'pause' }), false);
    expect(unknown.events[0]).toMatchObject({ type: 'error', code: 'protocol' });
  });

  it('refuses a second start on the same socket', () => {
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer: createScriptedStreamer([]), socket });

    session.handleMessage(encode({ type: 'start' }), false);
    session.handleMessage(encode({ type: 'start' }), false);

    expect(socket.events.at(-1)).toEqual({
      type: 'error',
      code: 'protocol',
      message: 'The session has already started',
    });
  });

  it('closes a session whose frames exceed the size limit', () => {
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({
      streamer: createScriptedStreamer([]),
      socket,
      maxFrameBytes: 4,
    });

    session.handleMessage(encode({ type: 'start' }), false);
    session.handleMessage(new Uint8Array(5), true);

    expect(socket.events.at(-1)).toEqual({
      type: 'error',
      code: 'limit_exceeded',
      message: 'Audio frame is too large',
    });
    expect(socket.closed).toEqual({ code: 1008, reason: 'limit_exceeded' });
  });

  it('refuses a client that runs too far ahead of the provider', () => {
    // A provider that never reads its audio, so the queue can only grow.
    const neverConsumes: TranscribeStreamer = {
      transcribe: (): AsyncIterable<TranscriptSegment> => ({
        [Symbol.asyncIterator]: (): AsyncIterator<TranscriptSegment> => ({
          next: (): Promise<IteratorResult<TranscriptSegment>> => new Promise(() => undefined),
        }),
      }),
    };
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({
      streamer: neverConsumes,
      socket,
      maxQueuedBytes: 6,
    });

    session.handleMessage(encode({ type: 'start' }), false);
    session.handleMessage(new Uint8Array(4), true);
    session.handleMessage(new Uint8Array(4), true);

    expect(socket.events.at(-1)).toMatchObject({ type: 'error', code: 'limit_exceeded' });
  });

  it('flushes automatically when the maximum duration is reached', async () => {
    const streamer = createScriptedStreamer([{ text: 'so far', isPartial: false }]);
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer, socket, maxDurationMs: 1_000 });

    session.handleMessage(encode({ type: 'start' }), false);
    vi.advanceTimersByTime(1_000);
    await flush();

    expect(socket.events.at(-1)).toEqual({
      type: 'end',
      transcript: 'so far',
      reason: 'max_duration',
    });
    expect(socket.closed).toEqual({ code: 1000, reason: 'end' });
  });

  it('expires a session that stops sending audio', () => {
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({
      streamer: createScriptedStreamer([]),
      socket,
      idleTimeoutMs: 500,
    });

    session.handleMessage(encode({ type: 'start' }), false);
    vi.advanceTimersByTime(400);
    session.handleMessage(new Uint8Array(2), true);
    vi.advanceTimersByTime(400);
    expect(socket.closed).toBeNull();

    vi.advanceTimersByTime(100);
    expect(socket.events.at(-1)).toMatchObject({ type: 'error', code: 'session_expired' });
    expect(socket.closed).toEqual({ code: 1008, reason: 'session_expired' });
  });

  it('reports a provider failure without leaking its message', async () => {
    const failing: TranscribeStreamer = {
      transcribe: (): AsyncIterable<TranscriptSegment> => {
        throw new SpeechProviderError('Signature expired for key AKIA...', false);
      },
    };
    const socket = createFakeSocket();
    const log = vi.fn();
    const session = new SpeechStreamSession({ streamer: failing, socket, log });

    session.handleMessage(encode({ type: 'start' }), false);
    await flush();

    expect(socket.events.at(-1)).toEqual({
      type: 'error',
      code: 'provider_unavailable',
      message: 'Speech could not be transcribed',
    });
    expect(socket.closed).toEqual({ code: 1011, reason: 'provider_unavailable' });
    expect(log).toHaveBeenCalledWith(
      'Speech provider rejected the session',
      expect.objectContaining({ message: 'Signature expired for key AKIA...' }),
    );
  });

  it('stops delivering once the client has gone away', async () => {
    const streamer = createScriptedStreamer([{ text: 'late', isPartial: false }]);
    const socket = createFakeSocket();
    const session = new SpeechStreamSession({ streamer, socket });

    session.handleMessage(encode({ type: 'start' }), false);
    session.handleClose();
    await flush();

    expect(socket.events).toHaveLength(1);
    expect(socket.events[0]).toMatchObject({ type: 'ready' });
    expect(socket.closed).toBeNull();
  });
});
