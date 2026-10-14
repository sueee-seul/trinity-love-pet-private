import Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConciergeChatRequest } from '../contracts/concierge.contract.js';
import type {
  AssistantTurnInput,
  ConciergeAssistant,
} from '../services/concierge/concierge.assistant.js';
import {
  ClaudeConciergeAssistant,
  type ClaudeMessagesClient,
} from '../services/concierge/concierge.claude-assistant.js';
import { createEmptyNeeds } from '../services/concierge/concierge.needs.js';
import { OpenAiConciergeAssistant } from '../services/concierge/concierge.openai-assistant.js';
import type { ChatCompletionRequest, MantleClient } from '../config/mantle.js';
import { RulesConciergeAssistant } from '../services/concierge/concierge.rules-assistant.js';
import {
  runConciergeTurn,
  type ConciergeServiceDependencies,
} from '../services/concierge/concierge.service.js';
import { clearLineTranslations } from '../common/language/translate-lines.js';
import type { BookingServiceRecord } from '../repositories/petparent.booking.repository.js';
import {
  CATALOGUE,
  readyNeeds,
  TEST_SIGNING_SECRET,
  TODAY,
} from './fixtures/concierge.fixtures.js';

// Scenario 11 on /book: a guest who writes in Korean is answered in Korean. The model writes its
// own words in Korean; a fixed line (here the price pointer that replaces a sentence about money)
// is written in English and translated by the same model before the reply goes out.

const PRICE_POINTER = 'You can see the exact price on the package cards.';
const PRICE_POINTER_KO = '정확한 가격은 패키지 카드에서 확인하실 수 있어요.';

const dependencies = (assistant: ConciergeAssistant): ConciergeServiceDependencies => ({
  assistant,
  loadCatalogue: async (): Promise<BookingServiceRecord[]> => CATALOGUE,
  today: (): string => TODAY,
  findFullNights: async (): Promise<string[]> => [],
});

const koreanRequest = (): ConciergeChatRequest => ({
  messages: [{ role: 'user', text: '스위트룸은 얼마예요? Bella는 처음 맡겨요.' }],
  needs: readyNeeds(),
  locale: 'en',
  trigger: 'message',
});

describe('booking assistant reply language', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
    clearLineTranslations();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it('translates the fixed price pointer into Korean with the assistant model', async () => {
    const turns: AssistantTurnInput[] = [];
    const translate = vi.fn(async (_system: string, prompt: string) =>
      JSON.stringify((JSON.parse(prompt) as string[]).map(() => PRICE_POINTER_KO)),
    );
    const korean: ConciergeAssistant = {
      mode: 'claude',
      respond: async (input) => {
        turns.push(input);
        return { reply: '스위트룸은 1박에 $85예요. Bella에게 잘 맞아요.', needsPatches: [] };
      },
      translate,
    };

    const response = await runConciergeTurn(koreanRequest(), dependencies(korean));

    expect(response.reply).toBe(`${PRICE_POINTER_KO} Bella에게 잘 맞아요.`);
    expect(turns[0]).toMatchObject({ locale: 'en', replyLanguage: 'ko' });
    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0]?.[0]).toContain('Korean (ko)');
    expect(JSON.parse(translate.mock.calls[0]?.[1] ?? '[]')).toEqual([PRICE_POINTER]);
    // The combo cards stay in the page's language.
    expect(response.combos[0]?.quote.name).toBe('Cosy room and House food');
  });

  it('falls back to English when the assistant has no model to translate with', async () => {
    const response = await runConciergeTurn(
      { ...koreanRequest(), needs: createEmptyNeeds() },
      dependencies(new RulesConciergeAssistant()),
    );

    expect(response.reply).toMatch(/[A-Za-z]/);
    expect(response.assistantAvailable).toBe(true);
  });
});

describe('ClaudeConciergeAssistant reply language', () => {
  const finalText = (value: string): Anthropic.Message =>
    ({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'm',
      content: [{ type: 'text', text: value, citations: null }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }) as Anthropic.Message;

  const recordingClient = (
    reply: string,
  ): { client: ClaudeMessagesClient; calls: Anthropic.MessageCreateParamsNonStreaming[] } => {
    const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const client: ClaudeMessagesClient = {
      messages: {
        create: async (params) => {
          calls.push(structuredClone(params));
          return finalText(reply);
        },
      },
    };
    return { client, calls };
  };

  it('asks the model to reply in the language of the last message', async () => {
    const { client, calls } = recordingClient('몇 마리 오나요?');
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    await assistant.respond({
      messages: [{ role: 'user', text: '다음 주에 강아지 맡기고 싶어요' }],
      needs: createEmptyNeeds(),
      locale: 'en',
      replyLanguage: 'ko',
      today: TODAY,
      describeOptions: async () => ({
        ready: false,
        missingFields: [],
        combos: [],
        services: { rooms: [], foods: [], addons: [] },
      }),
    });

    const request = calls[0];
    expect(request?.system).toContain("Reply in the language of the guest's last message");
    expect(request?.system).not.toContain('English or Chinese');
    const lastUser = request?.messages.at(-1);
    const context = Array.isArray(lastUser?.content) ? lastUser.content[0] : undefined;
    expect(context?.type === 'text' && context.text).toContain(
      "Reply language (from the guest's last message): Korean (ko)",
    );
  });

  it('translates with one plain call on the same model and client', async () => {
    const { client, calls } = recordingClient('["안녕하세요"]');
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'high' });

    expect(await assistant.translate('translate', '["Hello"]')).toBe('["안녕하세요"]');
    expect(calls[0]).toMatchObject({
      model: 'm',
      system: 'translate',
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: '["Hello"]' }],
    });
    expect(calls[0]?.tools).toBeUndefined();
  });
});

describe('OpenAiConciergeAssistant reply language', () => {
  it('names the reply language and translates on the same model', async () => {
    const requests: ChatCompletionRequest[] = [];
    const client: MantleClient = {
      complete: async (request) => {
        requests.push(structuredClone(request));
        return {
          choices: [
            { finish_reason: 'stop', message: { role: 'assistant', content: '["こんにちは"]' } },
          ],
        };
      },
    };
    const assistant = new OpenAiConciergeAssistant({ client, model: 'gpt-oss' });

    await assistant.respond({
      messages: [{ role: 'user', text: '来週犬を預けたいです' }],
      needs: createEmptyNeeds(),
      locale: 'en',
      replyLanguage: 'ja',
      today: TODAY,
      describeOptions: async () => ({
        ready: false,
        missingFields: [],
        combos: [],
        services: { rooms: [], foods: [], addons: [] },
      }),
    });
    expect(await assistant.translate('translate', '["Hello"]')).toBe('["こんにちは"]');

    const [chat, translation] = requests;
    expect(chat?.messages[0]?.content).toContain(
      "Reply in the language of the guest's last message",
    );
    expect(chat?.messages.at(-1)?.content).toContain(
      "Reply language (from the guest's last message): Japanese (ja)",
    );
    expect(translation).toMatchObject({
      model: 'gpt-oss',
      messages: [
        { role: 'system', content: 'translate' },
        { role: 'user', content: '["Hello"]' },
      ],
    });
    expect(translation?.tools).toBeUndefined();
  });
});
