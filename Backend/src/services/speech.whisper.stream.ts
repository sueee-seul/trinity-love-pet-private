import type { TranscribeStreamer, TranscriptSegment } from './speech.streamer.js';
import { UtteranceSegmenter } from './speech.utterance.segmenter.js';
import type { WhisperServiceClient, WhisperTranscription } from './speech.whisper.client.js';

/**
 * The local Whisper service as a `TranscribeStreamer`.
 *
 * Audio is cut into utterances by `UtteranceSegmenter`. Finals are transcribed one after another
 * so they reach the browser in spoken order. Partials are best effort: at most one is in flight,
 * none is sent while a final is pending, and a partial that returns after its utterance has closed
 * is dropped, so the live text never jumps back to an older guess.
 */

export interface WhisperStreamerOptions {
  client: WhisperServiceClient;
  createSegmenter?: () => UtteranceSegmenter;
  log?: (message: string, detail?: unknown) => void;
}

/** Pushed segments in, one async iterable out; a failure is rethrown to the reader. */
class SegmentChannel implements AsyncIterable<TranscriptSegment> {
  private readonly segments: TranscriptSegment[] = [];
  private wake: (() => void) | null = null;
  private closed = false;
  private failure: { error: unknown } | null = null;

  get isClosed(): boolean {
    return this.closed;
  }

  push(segment: TranscriptSegment): void {
    if (this.closed) {
      return;
    }
    this.segments.push(segment);
    this.notify();
  }

  close(): void {
    this.closed = true;
    this.notify();
  }

  fail(error: unknown): void {
    if (this.closed) {
      return;
    }
    this.failure = { error };
    this.close();
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<TranscriptSegment> {
    while (true) {
      const next = this.segments.shift();
      if (next) {
        yield next;
        continue;
      }
      if (this.failure) {
        throw this.failure.error;
      }
      if (this.closed) {
        return;
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }
}

const toSegment = (result: WhisperTranscription, isPartial: boolean): TranscriptSegment => ({
  text: result.text,
  isPartial,
  languageCode: result.language,
});

export const createWhisperStreamer = ({
  client,
  createSegmenter = (): UtteranceSegmenter => new UtteranceSegmenter(),
  log = (): void => undefined,
}: WhisperStreamerOptions): TranscribeStreamer => ({
  transcribe(audio, { sessionId, signal }): AsyncIterable<TranscriptSegment> {
    const channel = new SegmentChannel();
    const segmenter = createSegmenter();
    let finalsInOrder: Promise<void> = Promise.resolve();
    let pendingFinals = 0;
    let partialInFlight = false;
    let utteranceIndex = 0;

    const enqueueFinal = (pcm: Uint8Array<ArrayBuffer>): void => {
      pendingFinals += 1;
      utteranceIndex += 1;
      finalsInOrder = finalsInOrder
        .then(async () => {
          if (channel.isClosed) {
            return;
          }
          const result = await client.transcribe(pcm, signal);
          if (result.text) {
            channel.push(toSegment(result, false));
          }
        })
        // Failing the channel here keeps the chain resolved, so no rejection is left unhandled.
        .catch((error: unknown) => channel.fail(error))
        .finally(() => {
          pendingFinals -= 1;
        });
    };

    const requestPartial = (pcm: Uint8Array<ArrayBuffer>): void => {
      const forUtterance = utteranceIndex;
      partialInFlight = true;
      client
        .transcribe(pcm, signal)
        .then((result) => {
          if (forUtterance === utteranceIndex && pendingFinals === 0 && result.text) {
            channel.push(toSegment(result, true));
          }
        })
        .catch((error: unknown) => {
          // A partial is a preview; the final for the same audio reports a real failure.
          if (!signal.aborted) {
            log('Whisper partial transcription failed', {
              sessionId,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        })
        .finally(() => {
          partialInFlight = false;
        });
    };

    const pump = async (): Promise<void> => {
      for await (const chunk of audio) {
        if (channel.isClosed) {
          return;
        }
        for (const event of segmenter.push(chunk)) {
          if (event.kind === 'final') {
            enqueueFinal(event.audio);
          } else if (!partialInFlight && pendingFinals === 0) {
            requestPartial(event.audio);
          }
        }
      }
      const lastUtterance = segmenter.flush();
      if (lastUtterance) {
        enqueueFinal(lastUtterance.audio);
      }
      await finalsInOrder;
      channel.close();
    };

    pump().catch((error: unknown) => channel.fail(error));
    return channel;
  },
});
