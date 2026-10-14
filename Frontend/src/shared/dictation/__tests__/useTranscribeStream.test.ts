import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PcmCaptureHandle, PcmCaptureOptions } from '../audioCapture';
import { SpeechStreamError, type SpeechStreamClientHandlers } from '../speechStreamClient';
import {
  useTranscribeStream,
  type SpeechStreamConnection,
  type TranscribeStreamDependencies,
} from '../useTranscribeStream';

interface FakeConnection extends SpeechStreamConnection {
  handlers: SpeechStreamClientHandlers;
  connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  sendAudio: ReturnType<typeof vi.fn<(chunk: Int16Array) => void>>;
  stop: ReturnType<typeof vi.fn<() => void>>;
  abort: ReturnType<typeof vi.fn<() => void>>;
}

interface Harness {
  dependencies: TranscribeStreamDependencies;
  connections: FakeConnection[];
  captures: { options: PcmCaptureOptions; stop: ReturnType<typeof vi.fn<() => Promise<void>>> }[];
}

const createHarness = (connectResult: () => Promise<void> = () => Promise.resolve()): Harness => {
  const harness: Harness = {
    connections: [],
    captures: [],
    dependencies: {
      createClient: (handlers): SpeechStreamConnection => {
        const connection: FakeConnection = {
          handlers,
          connect: vi.fn(connectResult),
          sendAudio: vi.fn(),
          stop: vi.fn(),
          abort: vi.fn(),
        };
        harness.connections.push(connection);
        return connection;
      },
      startCapture: async (options): Promise<PcmCaptureHandle> => {
        const stop = vi.fn(async () => undefined);
        harness.captures.push({ options, stop });
        return { stop };
      },
    },
  };
  return harness;
};

const stream = {} as MediaStream;

describe('useTranscribeStream', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('connects before capturing and forwards audio chunks to the socket', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));

    await act(async () => {
      await result.current.start(stream);
    });

    const [connection] = harness.connections;
    const [capture] = harness.captures;
    expect(connection.connect).toHaveBeenCalledTimes(1);
    expect(capture.options.stream).toBe(stream);
    expect(capture.options.targetSampleRate).toBe(16_000);
    expect(result.current.isStreaming).toBe(true);

    const chunk = new Int16Array([1, 2, 3]);
    capture.options.onChunk(chunk);
    expect(connection.sendAudio).toHaveBeenCalledWith(chunk);
  });

  it('shows committed sentences plus the live partial while streaming', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });
    const { handlers } = harness.connections[0];

    act(() => handlers.onTranscript({ text: 'Bobo is', isPartial: true }));
    expect(result.current.interimTranscript).toBe('Bobo is');

    act(() => handlers.onTranscript({ text: 'Bobo is a dog.', isPartial: false }));
    act(() => handlers.onTranscript({ text: 'Allergic', isPartial: true }));
    expect(result.current.interimTranscript).toBe('Bobo is a dog. Allergic');
    expect(result.current.finalTranscript).toBe('');
  });

  it('stops capture, asks the server to finish, and commits the transcript on end', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });
    const connection = harness.connections[0];
    const capture = harness.captures[0];

    await act(async () => {
      await result.current.stop();
    });
    expect(capture.stop).toHaveBeenCalledTimes(1);
    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isFlushing).toBe(true);

    act(() => connection.handlers.onEnd('Bobo is a dog. Allergic to beef.', 'stopped'));
    expect(result.current.isFlushing).toBe(false);
    expect(result.current.finalTranscript).toBe('Bobo is a dog. Allergic to beef.');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('keeps the sentences already committed when the session fails part-way', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });
    const { handlers } = harness.connections[0];

    act(() => handlers.onTranscript({ text: 'Bobo is a dog.', isPartial: false }));
    act(() => handlers.onTranscript({ text: 'Allergic to', isPartial: true }));
    act(() => handlers.onError(new SpeechStreamError('session_expired', 'expired')));

    expect(result.current.finalTranscript).toBe('Bobo is a dog.');
    expect(result.current.error).toBe(
      'Voice input stopped early, so only the words recognised so far were added.',
    );
    expect(result.current.isStreaming).toBe(false);
    expect(harness.captures[0].stop).toHaveBeenCalled();
  });

  it('says nothing was added when the session fails before anything was recognised', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });

    act(() =>
      harness.connections[0].handlers.onError(
        new SpeechStreamError('provider_unavailable', 'Speech could not be transcribed'),
      ),
    );

    expect(result.current.finalTranscript).toBe('');
    expect(result.current.error).toBe(
      'Speech could not be transcribed, so nothing was added. Please type it instead.',
    );
  });

  it('reports a refused connection without opening the audio graph', async () => {
    harness = createHarness(() =>
      Promise.reject(new SpeechStreamError('unauthenticated', 'Authentication required')),
    );
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));

    await act(async () => {
      await expect(result.current.start(stream)).rejects.toThrow(
        'Please sign in again to use voice input.',
      );
    });

    expect(harness.captures).toHaveLength(0);
    expect(harness.connections[0].abort).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Please sign in again to use voice input.');
  });

  it('reset clears the transcript and the error', async () => {
    const { result } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });
    act(() => harness.connections[0].handlers.onEnd('Bobo', 'stopped'));
    expect(result.current.finalTranscript).toBe('Bobo');

    act(() => result.current.reset());

    expect(result.current.finalTranscript).toBe('');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('aborts the session and releases capture on unmount', async () => {
    const { result, unmount } = renderHook(() => useTranscribeStream(harness.dependencies));
    await act(async () => {
      await result.current.start(stream);
    });

    unmount();

    expect(harness.connections[0].abort).toHaveBeenCalledTimes(1);
    expect(harness.captures[0].stop).toHaveBeenCalledTimes(1);
  });
});
