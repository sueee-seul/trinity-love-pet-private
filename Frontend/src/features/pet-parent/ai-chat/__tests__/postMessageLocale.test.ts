import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { postMessageOnServer } from '../conversationApi';

const sentMessage = {
  message: {
    uuid: 'm-1',
    conversations_uuid: 'c-1',
    created_at: '2026-10-05T01:00:00.000Z',
    sender_role: 'pet_owner',
    topic: null,
    body: 'Biscuit 吃什么？',
  },
};

describe('postMessageOnServer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Pick<Response, 'ok' | 'json'>> => ({
        ok: true,
        json: async (): Promise<unknown> => sentMessage,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useConciergeStore.getState().setLocale('en');
  });

  // The AI answers in the language the parent reads the page in.
  it('sends the page language with the message', async () => {
    useConciergeStore.getState().setLocale('zh');

    await postMessageOnServer('c-1', 'Biscuit 吃什么？');

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ body: 'Biscuit 吃什么？', locale: 'zh' });
  });
});
