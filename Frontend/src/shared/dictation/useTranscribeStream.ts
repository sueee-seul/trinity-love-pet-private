import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEECH_STREAM_URL } from '../api';
import { startPcmCapture, type PcmCaptureHandle, type PcmCaptureOptions } from './audioCapture';
import { SPEECH_SAMPLE_RATE_HERTZ } from './pcm';
import {
  SpeechStreamClient,
  type SpeechStreamClientHandlers,
  type SpeechStreamError,
  type SpeechStreamErrorCode,
} from './speechStreamClient';

/**
 * Live transcription of a microphone stream through the Backend's speech socket.
 *
 * While streaming, `interimTranscript` is everything recognised so far in this dictation: the
 * committed sentences plus the sentence still being spoken, which the provider keeps rewriting
 * until it settles. On `stop` the provider flushes and `finalTranscript` is set once, which is the
 * moment `useDictation` appends it to the field.
 */

export interface TranscribeStreamState {
  isStreaming: boolean;
  /** Between `stop` and the server's final transcript. */
  isFlushing: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  start: (stream: MediaStream) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

export interface SpeechStreamConnection {
  connect: () => Promise<void>;
  sendAudio: (chunk: Int16Array) => void;
  stop: () => void;
  abort: () => void;
}

export interface TranscribeStreamDependencies {
  createClient: (handlers: SpeechStreamClientHandlers) => SpeechStreamConnection;
  startCapture: (options: PcmCaptureOptions) => Promise<PcmCaptureHandle>;
}

const defaultDependencies: TranscribeStreamDependencies = {
  createClient: (handlers): SpeechStreamConnection =>
    new SpeechStreamClient({ url: SPEECH_STREAM_URL, handlers }),
  startCapture: startPcmCapture,
};

/*
 * Every message says what happened to the words. The old wording promised a fallback that did not
 * exist; here a dictation that fails part-way keeps the sentences already committed and says so.
 */
const describeFailure = (code: SpeechStreamErrorCode, keptSomething: boolean): string => {
  if (keptSomething) {
    return 'Voice input stopped early, so only the words recognised so far were added.';
  }
  switch (code) {
    case 'unauthenticated':
      return 'Please sign in again to use voice input.';
    case 'connection':
      return 'Voice input could not reach the server, so nothing was added. Please type it instead.';
    default:
      return 'Speech could not be transcribed, so nothing was added. Please type it instead.';
  }
};

const describeMicrophoneFailure = (error: unknown): string =>
  error instanceof Error && error.name === 'SpeechStreamError'
    ? describeFailure((error as SpeechStreamError).code, false)
    : 'Voice input could not start. Please type it instead.';

export const useTranscribeStream = (
  dependencies: TranscribeStreamDependencies = defaultDependencies,
): TranscribeStreamState => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dependenciesRef = useRef(dependencies);
  useEffect(() => {
    dependenciesRef.current = dependencies;
  }, [dependencies]);
  const clientRef = useRef<SpeechStreamConnection | null>(null);
  const captureRef = useRef<PcmCaptureHandle | null>(null);
  const committedRef = useRef<string[]>([]);
  const partialRef = useRef('');

  const releaseCapture = useCallback(async (): Promise<void> => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) {
      await capture.stop();
    }
  }, []);

  const publishInterim = useCallback((): void => {
    setInterimTranscript(
      [...committedRef.current, partialRef.current].filter((part) => part.length > 0).join(' '),
    );
  }, []);

  const start = useCallback(
    async (stream: MediaStream): Promise<void> => {
      committedRef.current = [];
      partialRef.current = '';
      setInterimTranscript('');
      setFinalTranscript('');
      setError(null);

      const handlers: SpeechStreamClientHandlers = {
        onTranscript: (segment): void => {
          if (segment.isPartial) {
            partialRef.current = segment.text;
          } else {
            committedRef.current.push(segment.text);
            partialRef.current = '';
          }
          publishInterim();
        },
        onEnd: (transcript): void => {
          clientRef.current = null;
          void releaseCapture();
          setInterimTranscript('');
          setIsStreaming(false);
          setIsFlushing(false);
          setFinalTranscript(transcript);
        },
        onError: (failure): void => {
          clientRef.current = null;
          void releaseCapture();
          const kept = committedRef.current.join(' ');
          setInterimTranscript('');
          setIsStreaming(false);
          setIsFlushing(false);
          setError(describeFailure(failure.code, kept.length > 0));
          if (kept.length > 0) {
            setFinalTranscript(kept);
          }
        },
      };

      const client = dependenciesRef.current.createClient(handlers);
      try {
        // Connect before touching the audio graph so a refused session never leaves the mic open.
        await client.connect();
        clientRef.current = client;
        captureRef.current = await dependenciesRef.current.startCapture({
          stream,
          targetSampleRate: SPEECH_SAMPLE_RATE_HERTZ,
          onChunk: (chunk): void => client.sendAudio(chunk),
        });
      } catch (failure: unknown) {
        client.abort();
        clientRef.current = null;
        await releaseCapture();
        const message = describeMicrophoneFailure(failure);
        setError(message);
        throw new Error(message);
      }
      setIsStreaming(true);
    },
    [publishInterim, releaseCapture],
  );

  const stop = useCallback(async (): Promise<void> => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    setIsStreaming(false);
    setIsFlushing(true);
    await releaseCapture();
    client.stop();
  }, [releaseCapture]);

  const reset = useCallback((): void => {
    committedRef.current = [];
    partialRef.current = '';
    setInterimTranscript('');
    setFinalTranscript('');
    setError(null);
  }, []);

  useEffect(
    () => (): void => {
      clientRef.current?.abort();
      clientRef.current = null;
      void releaseCapture();
    },
    [releaseCapture],
  );

  return { isStreaming, isFlushing, interimTranscript, finalTranscript, error, start, stop, reset };
};
