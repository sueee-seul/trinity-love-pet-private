/**
 * The provider-neutral side of live dictation.
 *
 * The session code only knows `TranscribeStreamer`: push audio in, read segments out. Amazon
 * Transcribe and the local Whisper service each implement it, so the WebSocket protocol and the
 * Frontend do not change with the provider.
 */

export interface TranscriptSegment {
  text: string;
  /** Partial segments are replaced by the next event; a final one is committed. */
  isPartial: boolean;
  resultId?: string;
  languageCode?: string;
}

export interface TranscribeRequestOptions {
  /** Forwarded to the provider so its logs can be matched to ours. Transcribe requires a UUID. */
  sessionId: string;
  signal: AbortSignal;
}

export interface TranscribeStreamer {
  /**
   * Streams `audio` to the provider and yields segments as they arrive. The returned iterable
   * completes once `audio` has ended and the provider has flushed its final results.
   */
  transcribe(
    audio: AsyncIterable<Uint8Array>,
    options: TranscribeRequestOptions,
  ): AsyncIterable<TranscriptSegment>;
}

export class SpeechConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechConfigurationError';
  }
}

export class SpeechProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SpeechProviderError';
    this.retryable = retryable;
  }
}
