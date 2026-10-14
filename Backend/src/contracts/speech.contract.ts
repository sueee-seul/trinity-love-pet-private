import { z } from 'zod';

/**
 * Wire contract for live speech-to-text.
 *
 * The browser opens one WebSocket per dictation, sends a `start` control frame, then raw
 * 16 kHz mono PCM16 little-endian audio as binary frames, then `stop`. The server relays the
 * audio to Amazon Transcribe Streaming and sends transcript events back as JSON text frames until
 * it closes the socket with an `end` event. Nothing here is specific to Transcribe; a different
 * provider only has to implement `TranscribeStreamer`.
 */

export const SPEECH_STREAM_PATH = '/api/speech/stream';

/** Transcribe accepts 8 to 48 kHz PCM; 16 kHz keeps the upstream at 32 kB/s and is what speech models expect. */
export const SPEECH_SAMPLE_RATE_HERTZ = 16_000;

/** One dictation is capped so an abandoned tab cannot bill minutes of silence. */
export const SPEECH_MAX_SESSION_MS = 120_000;

/** A browser streams silence continuously, so a gap this long means the client is gone. */
export const SPEECH_IDLE_TIMEOUT_MS = 20_000;

/** 100 ms of 16 kHz PCM16 is 3.2 kB; anything near this limit is not audio from our client. */
export const SPEECH_MAX_AUDIO_FRAME_BYTES = 64 * 1024;

/** Audio buffered ahead of the provider before the session is refused as too far behind. */
export const SPEECH_MAX_QUEUED_AUDIO_BYTES = 2 * 1024 * 1024;

export const speechClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    sampleRate: z.literal(SPEECH_SAMPLE_RATE_HERTZ).optional(),
  }),
  z.object({ type: z.literal('stop') }),
]);

export type SpeechClientMessage = z.infer<typeof speechClientMessageSchema>;

export const SPEECH_ERROR_CODES = [
  'protocol',
  'unauthenticated',
  'not_configured',
  'provider_unavailable',
  'limit_exceeded',
  'session_expired',
] as const;

export type SpeechErrorCode = (typeof SPEECH_ERROR_CODES)[number];

export type SpeechEndReason = 'stopped' | 'max_duration';

export type SpeechServerEvent =
  | { type: 'ready'; sessionId: string; maxDurationMs: number }
  | { type: 'transcript'; text: string; isPartial: boolean; languageCode?: string }
  | { type: 'end'; transcript: string; reason: SpeechEndReason }
  | { type: 'error'; code: SpeechErrorCode; message: string };
