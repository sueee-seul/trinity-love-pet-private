import { randomUUID } from 'node:crypto';
import {
  SPEECH_IDLE_TIMEOUT_MS,
  SPEECH_MAX_AUDIO_FRAME_BYTES,
  SPEECH_MAX_QUEUED_AUDIO_BYTES,
  SPEECH_MAX_SESSION_MS,
  speechClientMessageSchema,
  type SpeechEndReason,
  type SpeechErrorCode,
  type SpeechServerEvent,
} from '../contracts/speech.contract.js';
import { SpeechProviderError, type TranscribeStreamer } from './speech.streamer.js';

/**
 * One dictation, from `start` to `end`, independent of the transport.
 *
 * The WebSocket layer hands frames in and gets JSON events out through `SpeechSessionSocket`; the
 * provider is a `TranscribeStreamer`. Both are plain interfaces so the whole state machine - limits,
 * timers, flush-on-stop, error mapping - runs under a unit test with no network and no `ws`.
 */

export interface SpeechSessionSocket {
  send(event: SpeechServerEvent): void;
  close(code: number, reason: string): void;
}

export interface SpeechStreamSessionOptions {
  streamer: TranscribeStreamer;
  socket: SpeechSessionSocket;
  sessionId?: string;
  maxDurationMs?: number;
  idleTimeoutMs?: number;
  maxFrameBytes?: number;
  maxQueuedBytes?: number;
  log?: (message: string, detail?: unknown) => void;
}

type SessionState = 'idle' | 'streaming' | 'flushing' | 'closed';

/** WebSocket close codes: normal, policy violation (our limits), and unexpected server condition. */
const CLOSE_NORMAL = 1000;
const CLOSE_POLICY_VIOLATION = 1008;
const CLOSE_SERVER_ERROR = 1011;

/**
 * Audio arrives as pushed frames but the provider wants a pull-based async iterable, so this is
 * the bridge. `queuedBytes` lets the session refuse a client that runs far ahead of the provider
 * instead of buffering without bound.
 */
class AudioQueue implements AsyncIterable<Uint8Array> {
  private readonly chunks: Uint8Array[] = [];
  private wake: (() => void) | null = null;
  private ended = false;
  queuedBytes = 0;

  push(chunk: Uint8Array): void {
    if (this.ended) {
      return;
    }
    this.chunks.push(chunk);
    this.queuedBytes += chunk.byteLength;
    this.notify();
  }

  end(): void {
    this.ended = true;
    this.notify();
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    while (true) {
      const next = this.chunks.shift();
      if (next) {
        this.queuedBytes -= next.byteLength;
        yield next;
        continue;
      }
      if (this.ended) {
        return;
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }
}

export class SpeechStreamSession {
  readonly sessionId: string;

  private state: SessionState = 'idle';
  private readonly queue = new AudioQueue();
  private readonly abortController = new AbortController();
  private readonly finalSegments: string[] = [];
  private readonly maxDurationMs: number;
  private readonly idleTimeoutMs: number;
  private readonly maxFrameBytes: number;
  private readonly maxQueuedBytes: number;
  private readonly streamer: TranscribeStreamer;
  private readonly socket: SpeechSessionSocket;
  private readonly log: (message: string, detail?: unknown) => void;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private endReason: SpeechEndReason = 'stopped';

  constructor(options: SpeechStreamSessionOptions) {
    this.sessionId = options.sessionId ?? randomUUID();
    this.streamer = options.streamer;
    this.socket = options.socket;
    this.maxDurationMs = options.maxDurationMs ?? SPEECH_MAX_SESSION_MS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? SPEECH_IDLE_TIMEOUT_MS;
    this.maxFrameBytes = options.maxFrameBytes ?? SPEECH_MAX_AUDIO_FRAME_BYTES;
    this.maxQueuedBytes = options.maxQueuedBytes ?? SPEECH_MAX_QUEUED_AUDIO_BYTES;
    this.log = options.log ?? ((): void => undefined);
  }

  /** Text frames are control messages; binary frames are audio. */
  handleMessage(data: string | Uint8Array, isBinary: boolean): void {
    if (this.state === 'closed') {
      return;
    }

    if (isBinary) {
      this.handleAudio(typeof data === 'string' ? new TextEncoder().encode(data) : data);
      return;
    }

    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.fail('protocol', 'Control messages must be JSON', CLOSE_POLICY_VIOLATION);
      return;
    }

    const message = speechClientMessageSchema.safeParse(parsed);
    if (!message.success) {
      this.fail('protocol', 'Unknown control message', CLOSE_POLICY_VIOLATION);
      return;
    }

    if (message.data.type === 'start') {
      this.start();
      return;
    }
    this.stop('stopped');
  }

  /** The client closed or the connection dropped: nothing more can be delivered. */
  handleClose(): void {
    if (this.state === 'closed') {
      return;
    }
    this.state = 'closed';
    this.clearTimers();
    this.queue.end();
    this.abortController.abort();
  }

  private start(): void {
    if (this.state !== 'idle') {
      this.fail('protocol', 'The session has already started', CLOSE_POLICY_VIOLATION);
      return;
    }

    this.state = 'streaming';
    this.socket.send({
      type: 'ready',
      sessionId: this.sessionId,
      maxDurationMs: this.maxDurationMs,
    });
    this.maxDurationTimer = setTimeout(() => this.stop('max_duration'), this.maxDurationMs);
    this.touchIdleTimer();
    void this.consume();
  }

  private handleAudio(chunk: Uint8Array): void {
    if (this.state !== 'streaming') {
      if (this.state === 'idle') {
        this.fail('protocol', 'Audio was sent before start', CLOSE_POLICY_VIOLATION);
      }
      // Frames still in flight after `stop` are dropped: the provider is already flushing.
      return;
    }

    if (chunk.byteLength > this.maxFrameBytes) {
      this.fail('limit_exceeded', 'Audio frame is too large', CLOSE_POLICY_VIOLATION);
      return;
    }

    if (this.queue.queuedBytes + chunk.byteLength > this.maxQueuedBytes) {
      this.fail(
        'limit_exceeded',
        'Audio is arriving faster than it can be transcribed',
        CLOSE_POLICY_VIOLATION,
      );
      return;
    }

    this.queue.push(chunk);
    this.touchIdleTimer();
  }

  private stop(reason: SpeechEndReason): void {
    if (this.state !== 'streaming') {
      return;
    }
    this.state = 'flushing';
    this.endReason = reason;
    this.clearTimers();
    // Ending the audio tells the provider to flush its last results; `consume` sends `end`.
    this.queue.end();
  }

  private async consume(): Promise<void> {
    try {
      const segments = this.streamer.transcribe(this.queue, {
        sessionId: this.sessionId,
        signal: this.abortController.signal,
      });
      for await (const segment of segments) {
        if (this.state === 'closed') {
          return;
        }
        if (!segment.isPartial) {
          this.finalSegments.push(segment.text);
        }
        this.socket.send({
          type: 'transcript',
          text: segment.text,
          isPartial: segment.isPartial,
          ...(segment.languageCode ? { languageCode: segment.languageCode } : {}),
        });
      }

      if (this.state === 'closed') {
        return;
      }
      this.socket.send({
        type: 'end',
        transcript: this.finalSegments.join(' '),
        reason: this.endReason,
      });
      this.finish(CLOSE_NORMAL, 'end');
    } catch (error: unknown) {
      if (this.state === 'closed') {
        return;
      }
      if (error instanceof SpeechProviderError) {
        this.log('Speech provider rejected the session', {
          sessionId: this.sessionId,
          message: error.message,
        });
        this.fail('provider_unavailable', 'Speech could not be transcribed', CLOSE_SERVER_ERROR);
        return;
      }
      this.log('Speech session failed', {
        sessionId: this.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      this.fail('provider_unavailable', 'Speech could not be transcribed', CLOSE_SERVER_ERROR);
    }
  }

  private touchIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.fail('session_expired', 'No audio was received for too long', CLOSE_POLICY_VIOLATION);
    }, this.idleTimeoutMs);
  }

  private clearTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private fail(code: SpeechErrorCode, message: string, closeCode: number): void {
    if (this.state === 'closed') {
      return;
    }
    this.socket.send({ type: 'error', code, message });
    this.finish(closeCode, code);
  }

  private finish(closeCode: number, reason: string): void {
    this.state = 'closed';
    this.clearTimers();
    this.queue.end();
    this.abortController.abort();
    this.socket.close(closeCode, reason);
  }
}
