import { describe, expect, it, vi } from 'vitest';
import { SpeechProviderError, type TranscriptSegment } from '../services/speech.streamer.js';
import { UtteranceSegmenter } from '../services/speech.utterance.segmenter.js';
import type {
  WhisperServiceClient,
  WhisperTranscription,
} from '../services/speech.whisper.client.js';
import { createWhisperStreamer } from '../services/speech.whisper.stream.js';

const pcm = (ms: number, level: number): Uint8Array => {
  const samples = ms * 16;
  const chunk = new Uint8Array(samples * 2);
  const view = new DataView(chunk.buffer);
  for (let index = 0; index < samples; index += 1) {
    view.setInt16(index * 2, Math.round((index % 2 === 0 ? 1 : -1) * level * 32_767), true);
  }
  return chunk;
};
const speech = (ms: number): Uint8Array => pcm(ms, 0.3);
const silence = (ms: number): Uint8Array => pcm(ms, 0);

async function* audioOf(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    yield chunk;
    // Let pending transcriptions settle between chunks, as real 40 ms frames would.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

interface ScriptedCall {
  byteLength: number;
  resolve: (result: WhisperTranscription) => void;
  reject: (error: unknown) => void;
}

/** Each call waits until the test answers it, so the order of answers is under test control. */
const createScriptedClient = (): WhisperServiceClient & { calls: ScriptedCall[] } => {
  const calls: ScriptedCall[] = [];
  return {
    calls,
    transcribe: (audio) =>
      new Promise<WhisperTranscription>((resolve, reject) => {
        calls.push({ byteLength: audio.byteLength, resolve, reject });
      }),
  };
};

/** A client that answers every call at once with the next scripted text. */
const createAnsweringClient = (texts: string[]): WhisperServiceClient => {
  let index = 0;
  return {
    transcribe: async () => ({ text: texts[index++] ?? '', language: 'en' }),
  };
};

const collect = async (
  segments: AsyncIterable<TranscriptSegment>,
): Promise<TranscriptSegment[]> => {
  const collected: TranscriptSegment[] = [];
  for await (const segment of segments) {
    collected.push(segment);
  }
  return collected;
};

const options = { sessionId: 'session-1', signal: new AbortController().signal };
const segmenterWith =
  (partialIntervalMs: number): (() => UtteranceSegmenter) =>
  (): UtteranceSegmenter =>
    new UtteranceSegmenter({ endSilenceMs: 300, partialIntervalMs, preRollMs: 0 });

describe('createWhisperStreamer', () => {
  it('emits one final per utterance, in spoken order, with the detected language', async () => {
    const streamer = createWhisperStreamer({
      client: createAnsweringClient(['Hello there.', '你好']),
      createSegmenter: segmenterWith(10_000),
    });

    const segments = await collect(
      streamer.transcribe(audioOf([speech(200), silence(300), speech(200), silence(300)]), options),
    );

    expect(segments).toEqual([
      { text: 'Hello there.', isPartial: false, languageCode: 'en' },
      { text: '你好', isPartial: false, languageCode: 'en' },
    ]);
  });

  it('transcribes finals one at a time, in spoken order', async () => {
    const client = createScriptedClient();
    const streamer = createWhisperStreamer({ client, createSegmenter: segmenterWith(10_000) });
    const result = collect(
      streamer.transcribe(audioOf([speech(200), silence(300), speech(400), silence(300)]), options),
    );

    // Finals are chained: the second request is only made once the first is answered.
    await vi.waitFor(() => expect(client.calls).toHaveLength(1));
    client.calls[0]?.resolve({ text: 'first', language: 'en' });
    await vi.waitFor(() => expect(client.calls).toHaveLength(2));
    client.calls[1]?.resolve({ text: 'second', language: 'en' });

    expect((await result).map((segment) => segment.text)).toEqual(['first', 'second']);
  });

  it('shows partials while speaking and transcribes the rest when the audio ends', async () => {
    const streamer = createWhisperStreamer({
      client: createAnsweringClient(['My dog', 'My dog is called Biscuit']),
      createSegmenter: segmenterWith(200),
    });

    const segments = await collect(
      streamer.transcribe(audioOf([speech(100), speech(100), speech(100)]), options),
    );

    expect(segments).toEqual([
      { text: 'My dog', isPartial: true, languageCode: 'en' },
      { text: 'My dog is called Biscuit', isPartial: false, languageCode: 'en' },
    ]);
  });

  it('drops a partial that comes back after its utterance has closed', async () => {
    const client = createScriptedClient();
    const streamer = createWhisperStreamer({ client, createSegmenter: segmenterWith(200) });
    const result = collect(
      streamer.transcribe(audioOf([speech(100), speech(100), silence(300)]), options),
    );

    await vi.waitFor(() => expect(client.calls).toHaveLength(2));
    client.calls[1]?.resolve({ text: 'final words', language: 'en' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.calls[0]?.resolve({ text: 'stale guess', language: 'en' });

    expect(await result).toEqual([{ text: 'final words', isPartial: false, languageCode: 'en' }]);
  });

  it('skips utterances that Whisper heard as empty', async () => {
    const streamer = createWhisperStreamer({
      client: createAnsweringClient(['']),
      createSegmenter: segmenterWith(10_000),
    });

    expect(
      await collect(streamer.transcribe(audioOf([speech(200), silence(300)]), options)),
    ).toEqual([]);
  });

  it('surfaces a failed final to the session as a provider error', async () => {
    const failure = new SpeechProviderError('Whisper service is not reachable', true);
    const streamer = createWhisperStreamer({
      client: { transcribe: async () => Promise.reject(failure) },
      createSegmenter: segmenterWith(10_000),
    });

    await expect(
      collect(streamer.transcribe(audioOf([speech(200), silence(300)]), options)),
    ).rejects.toBe(failure);
  });

  it('logs a failed partial without ending the session', async () => {
    const logged: string[] = [];
    let call = 0;
    const streamer = createWhisperStreamer({
      client: {
        transcribe: async () => {
          call += 1;
          if (call === 1) {
            throw new SpeechProviderError('busy', true);
          }
          return { text: 'still works', language: 'en' };
        },
      },
      createSegmenter: segmenterWith(200),
      log: (message) => logged.push(message),
    });

    const segments = await collect(
      streamer.transcribe(audioOf([speech(100), speech(100), silence(300)]), options),
    );

    expect(logged).toEqual(['Whisper partial transcription failed']);
    expect(segments).toEqual([{ text: 'still works', isPartial: false, languageCode: 'en' }]);
  });
});
