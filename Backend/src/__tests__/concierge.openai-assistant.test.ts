import { describe, expect, it, vi } from 'vitest';
import type { ConciergeNeeds } from '../contracts/concierge.contract.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatToolCall,
} from '../config/mantle.js';
import {
  ConciergeAssistantUnavailableError,
  type AssistantTurnInput,
} from '../services/concierge/concierge.assistant.js';
import { createEmptyNeeds, createEmptyPet } from '../services/concierge/concierge.needs.js';
import { OpenAiConciergeAssistant } from '../services/concierge/concierge.openai-assistant.js';

const TODAY = '2026-10-06';

const toolCall = (name: string, args: unknown, id = `call-${name}`): ChatToolCall => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});

const toolTurn = (...calls: ChatToolCall[]): ChatCompletionResponse => ({
  choices: [
    {
      finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: calls },
    },
  ],
});

const textTurn = (text: string): ChatCompletionResponse => ({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }],
});

/** A client that answers from a script, one response per call, and records what it was asked. */
const scripted = (
  responses: ChatCompletionResponse[],
): {
  client: { complete: (request: ChatCompletionRequest) => Promise<ChatCompletionResponse> };
  requests: ChatCompletionRequest[];
} => {
  const requests: ChatCompletionRequest[] = [];
  const complete = vi.fn(async (request: ChatCompletionRequest) => {
    requests.push(request);
    const next = responses.shift();
    if (!next) throw new Error('script exhausted');
    return next;
  });
  return { client: { complete }, requests };
};

const readyNeeds: ConciergeNeeds = {
  ...createEmptyNeeds(),
  service: 'boarding',
  startDate: '2026-12-20',
  endDate: '2026-12-23',
  pets: [{ ...createEmptyPet(), species: 'dog', size: 'medium', needsMedication: true }],
};

const inputFor = (
  text: string,
  needs: ConciergeNeeds = createEmptyNeeds(),
  locale: 'en' | 'zh' = 'en',
): AssistantTurnInput => ({
  messages: [{ role: 'user', text }],
  needs,
  locale,
  today: TODAY,
  describeOptions: async (current: ConciergeNeeds) => ({
    ready: current.startDate !== null && current.pets.length > 0,
    missingFields: [],
    combos: [
      {
        id: 'combo-simple',
        name: 'Standard room and Food from home',
        includesByPet: [['Standard room', 'Food from home']],
        reason: 'Everything you asked for and nothing more.',
        recommended: false,
      },
      {
        id: 'combo-roomier',
        name: 'Deluxe suite, House food and Daily walk',
        includesByPet: [['Deluxe suite', 'House food', 'Daily walk']],
        reason: 'A roomier suite, which suits a pet on medication.',
        recommended: true,
      },
      {
        id: 'combo-full',
        name: 'Garden suite, Fresh food, Walk and Play',
        includesByPet: [['Garden suite', 'Fresh food', 'Walk', 'Play']],
        reason: 'Every add-on included.',
        recommended: false,
      },
    ],
    services: {
      rooms: ['Standard room', 'Deluxe suite', 'Garden suite'],
      foods: ['Food from home', 'House food', 'Fresh food'],
      addons: ['Daily walk', 'Play'],
    },
  }),
  describeRules: async () => 'Cancel 7 days before drop-off: free.',
});

describe('OpenAiConciergeAssistant', () => {
  it('records the needs through the tool, then returns the reply and the patches', async () => {
    const { client, requests } = scripted([
      toolTurn(
        toolCall('record_booking_needs', {
          startDate: '2026-12-20',
          endDate: '2026-12-23',
          petCount: 1,
          pets: [{ index: 0, species: 'dog', size: 'medium' }],
        }),
      ),
      textTurn('Lovely, the options are below.'),
    ]);
    const assistant = new OpenAiConciergeAssistant({ client, model: 'openai.gpt-oss-120b' });
    const result = await assistant.respond(inputFor('One medium dog, 20 to 23 December'));

    expect(result.reply).toBe('Lovely, the options are below.');
    expect(result.needsPatches).toEqual([
      {
        startDate: '2026-12-20',
        endDate: '2026-12-23',
        petCount: 1,
        pets: [{ index: 0, species: 'dog', size: 'medium' }],
      },
    ]);
    expect(requests[0]?.model).toBe('openai.gpt-oss-120b');
    expect(requests[0]?.tools?.map((tool) => tool.function.name)).toEqual([
      'record_booking_needs',
      'get_stay_options',
      'get_booking_rules',
      'recommend_combo',
      'prepare_booking',
    ]);
    // The second call carries the tool result back under the model's own tool call id.
    const toolMessage = requests[1]?.messages.find((message) => message.role === 'tool');
    expect(toolMessage?.tool_call_id).toBe('call-record_booking_needs');
    expect(String(toolMessage?.content)).toContain('"saved":true');
  });

  it('keeps the recommendation the model made, worded without dashes', async () => {
    const { client } = scripted([
      toolTurn(
        toolCall('get_stay_options', {}, 'c1'),
        toolCall(
          'recommend_combo',
          {
            comboId: 'combo-roomier',
            reason: 'The suite suits a dog on medication — daily extras.',
          },
          'c2',
        ),
      ),
      textTurn('Your options are in the panel; I recommend the Deluxe suite.'),
    ]);
    const assistant = new OpenAiConciergeAssistant({ client, model: 'm' });
    const result = await assistant.respond(inputFor('Which one fits?', readyNeeds));
    expect(result.plan).toEqual({
      recommendedComboId: 'combo-roomier',
      reason: 'The suite suits a dog on medication, daily extras.',
      bookRequested: false,
      prefill: null,
    });
  });

  it('turns "book it" into a prepared booking with only the details the guest stated', async () => {
    const { client } = scripted([
      toolTurn(
        toolCall('prepare_booking', {
          firstName: 'Hana',
          phone: '021 555 0142',
          dropOffTime: '09:00',
          careNotes: 'Scared of thunder.',
        }),
      ),
      textTurn(
        'I have put the Deluxe suite in your stay and filled in the form below. Please check it and press Send.',
      ),
    ]);
    const assistant = new OpenAiConciergeAssistant({ client, model: 'm' });
    const result = await assistant.respond(inputFor('Book it for me please', readyNeeds));
    expect(result.plan).toMatchObject({
      recommendedComboId: 'combo-roomier',
      bookRequested: true,
      prefill: {
        firstName: 'Hana',
        phone: '021 555 0142',
        dropOffTime: '09:00',
        careNotes: 'Scared of thunder.',
      },
    });
    expect(result.plan?.reason).toContain('medication');
  });

  it('sends no plan while details are still missing, even if the model recommends', async () => {
    const { client } = scripted([
      toolTurn(toolCall('recommend_combo', { comboId: 'combo-simple', reason: 'Fine.' })),
      textTurn('Which dates?'),
    ]);
    const assistant = new OpenAiConciergeAssistant({ client, model: 'm' });
    const result = await assistant.respond(inputFor('A dog'));
    expect(result.plan).toBeNull();
  });

  it('refuses a bad patch without saving it, and reports a failed model as unavailable', async () => {
    const { client } = scripted([
      toolTurn(toolCall('record_booking_needs', { startDate: 'next friday' })),
      textTurn('Which exact dates?'),
    ]);
    const assistant = new OpenAiConciergeAssistant({ client, model: 'm' });
    const result = await assistant.respond(inputFor('next friday'));
    expect(result.needsPatches).toEqual([]);

    const log = vi.fn();
    const failing = new OpenAiConciergeAssistant({
      client: {
        complete: async (): Promise<ChatCompletionResponse> => {
          throw new Error('boom');
        },
      },
      model: 'm',
      log,
    });
    await expect(failing.respond(inputFor('hi'))).rejects.toBeInstanceOf(
      ConciergeAssistantUnavailableError,
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('hi');
  });
});
