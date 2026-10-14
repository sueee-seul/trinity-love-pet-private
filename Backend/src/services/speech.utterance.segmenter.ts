import { SPEECH_SAMPLE_RATE_HERTZ } from '../contracts/speech.contract.js';

/**
 * Splits a live PCM16 stream into utterances for a model that transcribes whole clips.
 *
 * Whisper is not a streaming recogniser, so live dictation is approximated: while someone speaks,
 * the utterance so far is offered as a `partial` about once a second (the person sees words
 * appear), and a pause or the length cap closes it as a `final` that is transcribed once and
 * committed. Speech is detected by frame energy against a noise floor learned from the stream, so
 * a quiet laptop microphone works as well as a headset; the Whisper service runs its own VAD on
 * each clip as a second filter.
 */

export type UtteranceEventKind = 'partial' | 'final';

export interface UtteranceEvent {
  kind: UtteranceEventKind;
  /** PCM16 little-endian audio from the start of the utterance up to now. */
  audio: Uint8Array<ArrayBuffer>;
}

export interface UtteranceSegmenterOptions {
  /** RMS level, as a fraction of full scale, below which a frame is never speech. */
  minSpeechThreshold?: number;
  /** How far above the learned noise floor a frame must be to count as speech. */
  speechToNoiseRatio?: number;
  /** Silence after speech that ends an utterance. */
  endSilenceMs?: number;
  /** Longest utterance before it is cut, so one request never grows without bound. */
  maxUtteranceMs?: number;
  /** Audio between two partial transcriptions of the same utterance. */
  partialIntervalMs?: number;
  /** Silence kept before the first speech frame so the first syllable is not clipped. */
  preRollMs?: number;
}

const BYTES_PER_SAMPLE = 2;
const BYTES_PER_MS = (SPEECH_SAMPLE_RATE_HERTZ * BYTES_PER_SAMPLE) / 1000;
const PCM16_FULL_SCALE = 32_768;

/**
 * About -54 dBFS. A fixed -40 dBFS gate (0.01) missed most words from a laptop microphone, where
 * speech measured 0.003 to 0.04 over a noise floor near 0.0015; the floor ratio does the real work.
 */
export const DEFAULT_MIN_SPEECH_THRESHOLD = 0.002;
export const DEFAULT_SPEECH_TO_NOISE_RATIO = 2.5;
/** Once speaking, a frame may drop this far below the floor ratio (never below the minimum). */
const SPEECH_HANGOVER_FACTOR = 0.7;
/**
 * The noise floor is the quietest frame in this window. Speech always has gaps between words, so
 * the minimum finds the room level within a few seconds, and a steady fan becomes the floor
 * instead of one endless utterance.
 */
const NOISE_FLOOR_WINDOW_MS = 3_000;
/** Long enough for a breath between words, short enough that a sentence commits promptly. */
export const DEFAULT_END_SILENCE_MS = 800;
export const DEFAULT_MAX_UTTERANCE_MS = 20_000;
export const DEFAULT_PARTIAL_INTERVAL_MS = 1_000;
export const DEFAULT_PRE_ROLL_MS = 300;

export const measureRms = (chunk: Uint8Array): number => {
  const sampleCount = Math.floor(chunk.byteLength / BYTES_PER_SAMPLE);
  if (sampleCount === 0) {
    return 0;
  }
  const view = new DataView(chunk.buffer, chunk.byteOffset, sampleCount * BYTES_PER_SAMPLE);
  let sumOfSquares = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(index * BYTES_PER_SAMPLE, true) / PCM16_FULL_SCALE;
    sumOfSquares += sample * sample;
  }
  return Math.sqrt(sumOfSquares / sampleCount);
};

const concatenate = (chunks: Uint8Array[], byteLength: number): Uint8Array<ArrayBuffer> => {
  // The Whisper service refuses odd-length PCM16; a stray byte is dropped rather than sent.
  const evenLength = byteLength - (byteLength % BYTES_PER_SAMPLE);
  const audio = new Uint8Array(evenLength);
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = evenLength - offset;
    if (remaining <= 0) {
      break;
    }
    const part = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
    audio.set(part, offset);
    offset += part.byteLength;
  }
  return audio;
};

interface LevelSample {
  rms: number;
  ms: number;
}

/**
 * Classifies each frame against the learned noise floor. Until a full window has been heard the
 * floor is unknown and only the minimum threshold applies, so someone who starts talking the
 * moment the microphone opens is not mistaken for background.
 */
class AdaptiveVoiceDetector {
  private readonly history: LevelSample[] = [];
  private historyMs = 0;

  constructor(
    private readonly minSpeechThreshold: number,
    private readonly speechToNoiseRatio: number,
  ) {}

  isSpeech(rms: number, chunkMs: number, isContinuingSpeech: boolean): boolean {
    this.remember(rms, chunkMs);
    const hangover = isContinuingSpeech ? SPEECH_HANGOVER_FACTOR : 1;
    const threshold = Math.max(
      this.minSpeechThreshold,
      this.noiseFloor() * this.speechToNoiseRatio * hangover,
    );
    return rms >= threshold;
  }

  private remember(rms: number, chunkMs: number): void {
    this.history.push({ rms, ms: chunkMs });
    this.historyMs += chunkMs;
    let oldest = this.history[0];
    while (oldest && this.historyMs - oldest.ms >= NOISE_FLOOR_WINDOW_MS) {
      this.historyMs -= oldest.ms;
      this.history.shift();
      oldest = this.history[0];
    }
  }

  private noiseFloor(): number {
    if (this.historyMs < NOISE_FLOOR_WINDOW_MS) {
      return 0;
    }
    return Math.min(...this.history.map((sample) => sample.rms));
  }
}

export class UtteranceSegmenter {
  private readonly voiceDetector: AdaptiveVoiceDetector;
  private readonly endSilenceMs: number;
  private readonly maxUtteranceMs: number;
  private readonly partialIntervalMs: number;
  private readonly preRollMs: number;

  private preRoll: Uint8Array[] = [];
  private preRollBytes = 0;
  private utterance: Uint8Array[] = [];
  private utteranceBytes = 0;
  private hasSpeech = false;
  private trailingSilenceMs = 0;
  private msSinceLastPartial = 0;

  constructor(options: UtteranceSegmenterOptions = {}) {
    this.voiceDetector = new AdaptiveVoiceDetector(
      options.minSpeechThreshold ?? DEFAULT_MIN_SPEECH_THRESHOLD,
      options.speechToNoiseRatio ?? DEFAULT_SPEECH_TO_NOISE_RATIO,
    );
    this.endSilenceMs = options.endSilenceMs ?? DEFAULT_END_SILENCE_MS;
    this.maxUtteranceMs = options.maxUtteranceMs ?? DEFAULT_MAX_UTTERANCE_MS;
    this.partialIntervalMs = options.partialIntervalMs ?? DEFAULT_PARTIAL_INTERVAL_MS;
    this.preRollMs = options.preRollMs ?? DEFAULT_PRE_ROLL_MS;
  }

  push(chunk: Uint8Array): UtteranceEvent[] {
    const chunkMs = chunk.byteLength / BYTES_PER_MS;
    const isContinuingSpeech = this.hasSpeech && this.trailingSilenceMs === 0;
    const isSpeech = this.voiceDetector.isSpeech(measureRms(chunk), chunkMs, isContinuingSpeech);

    if (!this.hasSpeech) {
      if (!isSpeech) {
        this.keepPreRoll(chunk);
        return [];
      }
      this.hasSpeech = true;
      this.utterance = this.preRoll;
      this.utteranceBytes = this.preRollBytes;
      this.preRoll = [];
      this.preRollBytes = 0;
    }

    this.utterance.push(chunk);
    this.utteranceBytes += chunk.byteLength;
    this.trailingSilenceMs = isSpeech ? 0 : this.trailingSilenceMs + chunkMs;
    this.msSinceLastPartial += chunkMs;

    const utteranceMs = this.utteranceBytes / BYTES_PER_MS;
    if (this.trailingSilenceMs >= this.endSilenceMs || utteranceMs >= this.maxUtteranceMs) {
      return [{ kind: 'final', audio: this.takeUtterance() }];
    }
    if (this.msSinceLastPartial >= this.partialIntervalMs) {
      this.msSinceLastPartial = 0;
      return [{ kind: 'partial', audio: concatenate(this.utterance, this.utteranceBytes) }];
    }
    return [];
  }

  /** The audio has ended: whatever was being said becomes the last final utterance. */
  flush(): UtteranceEvent | null {
    if (!this.hasSpeech) {
      return null;
    }
    return { kind: 'final', audio: this.takeUtterance() };
  }

  private keepPreRoll(chunk: Uint8Array): void {
    this.preRoll.push(chunk);
    this.preRollBytes += chunk.byteLength;
    const maxPreRollBytes = this.preRollMs * BYTES_PER_MS;
    let oldest = this.preRoll[0];
    while (oldest && this.preRollBytes - oldest.byteLength >= maxPreRollBytes) {
      this.preRollBytes -= oldest.byteLength;
      this.preRoll.shift();
      oldest = this.preRoll[0];
    }
  }

  private takeUtterance(): Uint8Array<ArrayBuffer> {
    const audio = concatenate(this.utterance, this.utteranceBytes);
    this.utterance = [];
    this.utteranceBytes = 0;
    this.hasSpeech = false;
    this.trailingSilenceMs = 0;
    this.msSinceLastPartial = 0;
    return audio;
  }
}
