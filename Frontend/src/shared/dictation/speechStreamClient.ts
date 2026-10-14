import { concatInt16, SPEECH_SAMPLE_RATE_HERTZ } from './pcm';

/**
 * Browser side of the live dictation protocol (see `Backend/src/contracts/speech.contract.ts`).
 *
 * One socket per dictation: `connect` sends `start` and resolves on the server's `ready`; audio
 * goes out as binary frames; `stop` flushes what is buffered and asks the server to finish, after
 * which the server sends `end` and closes. The `WebSocket` constructor is injectable so the whole
 * exchange can be exercised with a fake socket.
 */

export type SpeechStreamErrorCode =
  | 'protocol'
  | 'unauthenticated'
  | 'not_configured'
  | 'provider_unavailable'
  | 'limit_exceeded'
  | 'session_expired'
  | 'connection';

export interface SpeechTranscriptSegment {
  text: string;
  isPartial: boolean;
  languageCode?: string;
}

export type SpeechEndReason = 'stopped' | 'max_duration';

export interface SpeechStreamClientHandlers {
  onTranscript: (segment: SpeechTranscriptSegment) => void;
  onEnd: (transcript: string, reason: SpeechEndReason) => void;
  onError: (error: SpeechStreamError) => void;
}

export class SpeechStreamError extends Error {
  readonly code: SpeechStreamErrorCode;

  constructor(code: SpeechStreamErrorCode, message: string) {
    super(message);
    this.name = 'SpeechStreamError';
    this.code = code;
  }
}

export interface SpeechStreamClientOptions {
  url: string;
  handlers: SpeechStreamClientHandlers;
  WebSocketImpl?: typeof WebSocket;
  /** Audio is sent once this many samples are buffered: 1600 is 100 ms at 16 kHz. */
  batchSamples?: number;
}

type ServerEvent =
  | { type: 'ready'; sessionId: string; maxDurationMs: number }
  | { type: 'transcript'; text: string; isPartial: boolean; languageCode?: string }
  | { type: 'end'; transcript: string; reason: SpeechEndReason }
  | { type: 'error'; code: SpeechStreamErrorCode; message: string };

const SOCKET_OPEN = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseServerEvent = (data: unknown): ServerEvent | null => {
  if (typeof data !== 'string') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return null;
  }
  switch (parsed.type) {
    case 'ready':
      return typeof parsed.sessionId === 'string' && typeof parsed.maxDurationMs === 'number'
        ? { type: 'ready', sessionId: parsed.sessionId, maxDurationMs: parsed.maxDurationMs }
        : null;
    case 'transcript':
      return typeof parsed.text === 'string' && typeof parsed.isPartial === 'boolean'
        ? {
            type: 'transcript',
            text: parsed.text,
            isPartial: parsed.isPartial,
            ...(typeof parsed.languageCode === 'string'
              ? { languageCode: parsed.languageCode }
              : {}),
          }
        : null;
    case 'end':
      return typeof parsed.transcript === 'string'
        ? {
            type: 'end',
            transcript: parsed.transcript,
            reason: parsed.reason === 'max_duration' ? 'max_duration' : 'stopped',
          }
        : null;
    case 'error':
      return typeof parsed.code === 'string' && typeof parsed.message === 'string'
        ? { type: 'error', code: parsed.code as SpeechStreamErrorCode, message: parsed.message }
        : null;
    default:
      return null;
  }
};

export class SpeechStreamClient {
  private readonly url: string;
  private readonly handlers: SpeechStreamClientHandlers;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly batchSamples: number;
  private socket: WebSocket | null = null;
  private pending: Int16Array[] = [];
  private pendingSamples = 0;
  /** Set once the server has said its last word, so a later `close` is not reported as a failure. */
  private finished = false;

  constructor(options: SpeechStreamClientOptions) {
    this.url = options.url;
    this.handlers = options.handlers;
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
    this.batchSamples = options.batchSamples ?? 1600;
  }

  /** Resolves once the server is ready for audio; rejects with a `SpeechStreamError` otherwise. */
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new this.WebSocketImpl(this.url);
      } catch {
        reject(new SpeechStreamError('connection', 'Voice input could not reach the server'));
        return;
      }
      socket.binaryType = 'arraybuffer';
      this.socket = socket;
      let ready = false;

      socket.onopen = (): void => {
        socket.send(JSON.stringify({ type: 'start', sampleRate: SPEECH_SAMPLE_RATE_HERTZ }));
      };

      socket.onmessage = (event: MessageEvent): void => {
        const message = parseServerEvent(event.data);
        if (!message) {
          return;
        }
        switch (message.type) {
          case 'ready':
            ready = true;
            resolve();
            break;
          case 'transcript':
            this.handlers.onTranscript({
              text: message.text,
              isPartial: message.isPartial,
              ...(message.languageCode ? { languageCode: message.languageCode } : {}),
            });
            break;
          case 'end':
            this.finished = true;
            this.handlers.onEnd(message.transcript, message.reason);
            break;
          case 'error': {
            this.finished = true;
            const error = new SpeechStreamError(message.code, message.message);
            if (ready) {
              this.handlers.onError(error);
            } else {
              reject(error);
            }
            break;
          }
        }
      };

      socket.onerror = (): void => {
        if (!ready) {
          reject(new SpeechStreamError('connection', 'Voice input could not reach the server'));
        }
      };

      socket.onclose = (): void => {
        if (!ready) {
          reject(new SpeechStreamError('connection', 'Voice input could not reach the server'));
          return;
        }
        if (!this.finished) {
          this.finished = true;
          this.handlers.onError(
            new SpeechStreamError(
              'connection',
              'The connection closed before the transcript finished',
            ),
          );
        }
      };
    });
  }

  sendAudio(chunk: Int16Array): void {
    if (this.finished || this.socket?.readyState !== SOCKET_OPEN) {
      return;
    }
    this.pending.push(chunk);
    this.pendingSamples += chunk.length;
    if (this.pendingSamples >= this.batchSamples) {
      this.flush();
    }
  }

  /** Sends what is buffered and asks the server to finish; `onEnd` follows with the transcript. */
  stop(): void {
    this.flush();
    if (this.socket?.readyState === SOCKET_OPEN && !this.finished) {
      this.socket.send(JSON.stringify({ type: 'stop' }));
    }
  }

  /** Drops the session without waiting for a transcript. */
  abort(): void {
    this.finished = true;
    this.pending = [];
    this.pendingSamples = 0;
    this.socket?.close();
    this.socket = null;
  }

  private flush(): void {
    if (this.pendingSamples === 0 || this.socket?.readyState !== SOCKET_OPEN) {
      return;
    }
    const merged = concatInt16(this.pending);
    this.pending = [];
    this.pendingSamples = 0;
    // `concatInt16` allocates a fresh Int16Array, so its buffer is a plain ArrayBuffer.
    this.socket.send(merged.buffer as ArrayBuffer);
  }
}
