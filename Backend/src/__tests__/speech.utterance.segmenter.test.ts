import { describe, expect, it } from 'vitest';
import {
  measureRms,
  UtteranceSegmenter,
  type UtteranceEvent,
} from '../services/speech.utterance.segmenter.js';

const BYTES_PER_MS = 32;

/** `ms` of 16 kHz PCM16 at a constant level; 0.3 of full scale reads as speech, 0 as silence. */
const pcm = (ms: number, level: number): Uint8Array => {
  const samples = ms * 16;
  const chunk = new Uint8Array(samples * 2);
  const view = new DataView(chunk.buffer);
  for (let index = 0; index < samples; index += 1) {
    // Alternate the sign so the level is an RMS, not a DC offset.
    view.setInt16(index * 2, Math.round((index % 2 === 0 ? 1 : -1) * level * 32_767), true);
  }
  return chunk;
};

const speech = (ms: number): Uint8Array => pcm(ms, 0.3);
const silence = (ms: number): Uint8Array => pcm(ms, 0);

const feed = (segmenter: UtteranceSegmenter, chunks: Uint8Array[]): UtteranceEvent[] =>
  chunks.flatMap((chunk) => segmenter.push(chunk));

const repeat = (count: number, chunk: () => Uint8Array): Uint8Array[] =>
  Array.from({ length: count }, chunk);

describe('measureRms', () => {
  it('reads silence as zero and a constant level as that level', () => {
    expect(measureRms(silence(20))).toBe(0);
    expect(measureRms(speech(20))).toBeCloseTo(0.3, 3);
    expect(measureRms(new Uint8Array(1))).toBe(0);
  });
});

describe('UtteranceSegmenter', () => {
  it('ignores silence before anyone speaks', () => {
    const segmenter = new UtteranceSegmenter();
    expect(
      feed(
        segmenter,
        repeat(50, () => silence(100)),
      ),
    ).toEqual([]);
    expect(segmenter.flush()).toBeNull();
  });

  it('closes an utterance after the end-of-speech silence, keeping the pre-roll', () => {
    const segmenter = new UtteranceSegmenter({
      endSilenceMs: 600,
      preRollMs: 300,
      partialIntervalMs: 10_000,
    });
    const events = feed(segmenter, [
      ...repeat(10, () => silence(100)),
      ...repeat(5, () => speech(100)),
      ...repeat(6, () => silence(100)),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('final');
    // 300 ms pre-roll + 500 ms speech + 600 ms silence.
    expect(events[0]?.audio.byteLength).toBe(1_400 * BYTES_PER_MS);
  });

  it('offers the utterance so far as a partial about once per interval', () => {
    const segmenter = new UtteranceSegmenter({ partialIntervalMs: 1_000, preRollMs: 0 });
    const events = feed(
      segmenter,
      repeat(25, () => speech(100)),
    );

    expect(events.map((event) => event.kind)).toEqual(['partial', 'partial']);
    expect(events[0]?.audio.byteLength).toBe(1_000 * BYTES_PER_MS);
    expect(events[1]?.audio.byteLength).toBe(2_000 * BYTES_PER_MS);
  });

  it('cuts an utterance at the length cap even without a pause', () => {
    const segmenter = new UtteranceSegmenter({ maxUtteranceMs: 2_000, partialIntervalMs: 10_000 });
    const events = feed(
      segmenter,
      repeat(30, () => speech(100)),
    );

    expect(events.map((event) => event.kind)).toEqual(['final']);
    expect(events[0]?.audio.byteLength).toBe(2_000 * BYTES_PER_MS);
  });

  it('flushes the words still being spoken when the audio ends', () => {
    const segmenter = new UtteranceSegmenter({ partialIntervalMs: 10_000, preRollMs: 0 });
    feed(
      segmenter,
      repeat(4, () => speech(100)),
    );

    expect(segmenter.flush()).toEqual({
      kind: 'final',
      audio: expect.objectContaining({ byteLength: 400 * BYTES_PER_MS }),
    });
    expect(segmenter.flush()).toBeNull();
  });

  it('hears quiet laptop-microphone speech over a learned noise floor', () => {
    // Levels measured from a laptop microphone: room noise near 0.0015, speech near 0.004.
    const segmenter = new UtteranceSegmenter({
      endSilenceMs: 600,
      partialIntervalMs: 10_000,
      preRollMs: 0,
    });
    const events = feed(segmenter, [
      ...repeat(10, () => pcm(100, 0.0015)),
      ...repeat(8, () => pcm(100, 0.005)),
      ...repeat(7, () => pcm(100, 0.0015)),
    ]);

    expect(events.map((event) => event.kind)).toEqual(['final']);
    expect(events[0]?.audio.byteLength).toBe(1_400 * BYTES_PER_MS);
  });

  it('learns a louder room instead of treating it as one endless utterance', () => {
    const segmenter = new UtteranceSegmenter({ partialIntervalMs: 10_000 });
    // A fan switches on: steady 0.003 noise, no speech, for 10 s.
    feed(segmenter, [pcm(100, 0.0005), ...repeat(100, () => pcm(100, 0.003))]);

    expect(segmenter.flush()).toBeNull();
  });

  it('drops a stray odd byte so the service always receives whole samples', () => {
    const segmenter = new UtteranceSegmenter({ preRollMs: 0 });
    segmenter.push(speech(100));
    segmenter.push(new Uint8Array([1]));

    expect(segmenter.flush()?.audio.byteLength).toBe(100 * BYTES_PER_MS);
  });
});
