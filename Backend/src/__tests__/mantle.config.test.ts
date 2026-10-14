import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_MANTLE_BASE_URL,
  DEFAULT_VISION_MODEL,
  FetchMantleClient,
  MantleCallError,
  readMantleSettings,
  readModelName,
  reloadModelKeys,
} from '../config/mantle.js';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('readMantleSettings', () => {
  it('reads the shared LLM key and endpoint, defaulting the endpoint to Mantle in Sydney', () => {
    expect(readMantleSettings({ LLM_API_KEY: 'bedrock-api-key-abc' })).toEqual({
      baseUrl: DEFAULT_MANTLE_BASE_URL,
      apiKey: 'bedrock-api-key-abc',
    });
    expect(
      readMantleSettings({ LLM_API_KEY: 'k', LLM_BASE_URL: 'https://example.test/v1/' }),
    ).toEqual({ baseUrl: 'https://example.test/v1', apiKey: 'k' });
  });

  it('is null without a key, and treats the local Ollama placeholder as no key', () => {
    expect(readMantleSettings({})).toBeNull();
    expect(readMantleSettings({ LLM_API_KEY: ' ' })).toBeNull();
    expect(readMantleSettings({ LLM_API_KEY: 'ollama' })).toBeNull();
  });
});

describe('readModelName', () => {
  it('lets each feature name its model and falls back to the shared one, then the defaults', () => {
    expect(readModelName('chat', {})).toBe(DEFAULT_CHAT_MODEL);
    expect(readModelName('chat', { LLM_MODEL: 'openai.gpt-oss-20b' })).toBe('openai.gpt-oss-20b');
    expect(
      readModelName('chat', {
        LLM_MODEL: 'openai.gpt-oss-20b',
        CONCIERGE_OPENAI_MODEL: 'zai.glm-5',
      }),
    ).toBe('zai.glm-5');
    expect(readModelName('vision', {})).toBe(DEFAULT_VISION_MODEL);
    expect(readModelName('writer', { UPDATE_WRITER_MODEL: 'x' })).toBe('x');
  });
});

describe('reloadModelKeys', () => {
  it('refreshes only the model keys from the file and reports whether anything changed', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mantle-'));
    const envPath = path.join(dir, '.env');
    writeFileSync(envPath, 'LLM_API_KEY=new-key\nPOSTGRESQL_URL=must-not-change\n');
    const environment: Record<string, string | undefined> = {
      LLM_API_KEY: 'old-key',
      POSTGRESQL_URL: 'db',
    };
    expect(reloadModelKeys(envPath, environment)).toBe(true);
    expect(environment.LLM_API_KEY).toBe('new-key');
    expect(environment.POSTGRESQL_URL).toBe('db');
    expect(reloadModelKeys(envPath, environment)).toBe(false);
    expect(reloadModelKeys(path.join(dir, 'missing.env'), environment)).toBe(false);
  });
});

describe('FetchMantleClient', () => {
  const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };

  it('posts to chat/completions with the bearer key and returns the choices', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'OK' } }],
      }),
    );
    const client = new FetchMantleClient({ LLM_API_KEY: 'key-1' }, fetchImpl as typeof fetch);
    const response = await client.complete(request);
    expect(response.choices[0]?.message.content).toBe('OK');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_MANTLE_BASE_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-1');
  });

  it('on a 401 reloads the keys once and retries with the new key', async () => {
    const environment: Record<string, string | undefined> = { LLM_API_KEY: 'stale' };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: 'expired' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'fresh' } }],
        }),
      );
    const reload = vi.fn(() => {
      environment.LLM_API_KEY = 'rotated';
      return true;
    });
    const client = new FetchMantleClient(environment, fetchImpl as typeof fetch, reload);
    const response = await client.complete(request);
    expect(response.choices[0]?.message.content).toBe('fresh');
    expect(reload).toHaveBeenCalledTimes(1);
    const retry = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect((retry[1].headers as Record<string, string>).Authorization).toBe('Bearer rotated');
  });

  it('fails with the status when the key is still refused, and without a key at all', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: { message: 'expired' } }));
    const client = new FetchMantleClient(
      { LLM_API_KEY: 'stale' },
      fetchImpl as typeof fetch,
      () => false,
    );
    await expect(client.complete(request)).rejects.toMatchObject({ status: 401 });
    await expect(
      new FetchMantleClient({}, fetchImpl as typeof fetch, () => false).complete(request),
    ).rejects.toBeInstanceOf(MantleCallError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
