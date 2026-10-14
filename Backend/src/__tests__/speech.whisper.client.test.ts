import { describe, expect, it, vi } from 'vitest';
import { SpeechConfigurationError, SpeechProviderError } from '../services/speech.streamer.js';
import {
  createWhisperServiceClient,
  DEFAULT_WHISPER_SERVICE_URL,
  getWhisperServiceUrl,
  WHISPER_REQUEST_TIMEOUT_MS,
  type WhisperServiceClient,
} from '../services/speech.whisper.client.js';

const audio = new Uint8Array(3_200);
const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const createClient = (
  fetchImpl: typeof fetch,
  timeoutMs = WHISPER_REQUEST_TIMEOUT_MS,
): WhisperServiceClient =>
  createWhisperServiceClient({ baseUrl: 'http://127.0.0.1:8765', fetchImpl, timeoutMs });

describe('getWhisperServiceUrl', () => {
  it('defaults to the local service and keeps only the origin', () => {
    expect(getWhisperServiceUrl({})).toBe(DEFAULT_WHISPER_SERVICE_URL);
    expect(getWhisperServiceUrl({ WHISPER_SERVICE_URL: 'http://speech:9000/' })).toBe(
      'http://speech:9000',
    );
  });

  it('refuses a value that is not an http(s) URL', () => {
    expect(() => getWhisperServiceUrl({ WHISPER_SERVICE_URL: 'speech:9000' })).toThrow(
      SpeechConfigurationError,
    );
    expect(() => getWhisperServiceUrl({ WHISPER_SERVICE_URL: 'not a url' })).toThrow(
      SpeechConfigurationError,
    );
  });
});

describe('createWhisperServiceClient', () => {
  it('posts the PCM to /transcribe and returns the trimmed text and language', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { text: ' 我的狗叫饼干 ', language: 'zh', elapsedMs: 512 }),
    );

    const result = await createClient(fetchImpl).transcribe(audio, new AbortController().signal);

    expect(result).toEqual({ text: '我的狗叫饼干', language: 'zh' });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:8765/transcribe');
    expect(init).toMatchObject({ method: 'POST', body: audio });
  });

  it('reports a service that is not running as retryable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(
      createClient(fetchImpl).transcribe(audio, new AbortController().signal),
    ).rejects.toMatchObject({ name: 'SpeechProviderError', retryable: true });
  });

  it('treats a 4xx as permanent and a 5xx as retryable', async () => {
    const badRequest = createClient(
      vi.fn<typeof fetch>(async () => jsonResponse(400, { error: 'Audio is empty' })),
    );
    const serverError = createClient(
      vi.fn<typeof fetch>(async () => jsonResponse(500, { error: 'boom' })),
    );
    const signal = new AbortController().signal;

    await expect(badRequest.transcribe(audio, signal)).rejects.toMatchObject({ retryable: false });
    await expect(serverError.transcribe(audio, signal)).rejects.toMatchObject({ retryable: true });
  });

  it('rejects a response that does not match the contract', async () => {
    const client = createClient(vi.fn<typeof fetch>(async () => jsonResponse(200, { words: [] })));

    await expect(client.transcribe(audio, new AbortController().signal)).rejects.toBeInstanceOf(
      SpeechProviderError,
    );
  });

  it('gives up on a service that does not answer in time', async () => {
    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    await expect(
      createClient(hanging, 20).transcribe(audio, new AbortController().signal),
    ).rejects.toMatchObject({ retryable: true, message: expect.stringContaining('20 ms') });
  });

  it('passes the session abort through untouched', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('aborted', 'AbortError');
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      controller.abort();
      throw abortError;
    });

    await expect(createClient(fetchImpl).transcribe(audio, controller.signal)).rejects.toBe(
      abortError,
    );
  });
});
