import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_FORMATTING_RULE } from '../common/language/chat-formatting.js';
import {
  ClaudeConciergeAssistant,
  type ClaudeMessagesClient,
} from '../services/concierge/concierge.claude-assistant.js';
import { ConciergeAssistantUnavailableError } from '../services/concierge/concierge.assistant.js';
import { createEmptyNeeds, mergeNeeds } from '../services/concierge/concierge.needs.js';
import { TODAY } from './fixtures/concierge.fixtures.js';

const usage = { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage;

const message = (
  content: Anthropic.ContentBlock[],
  stopReason: Anthropic.Message['stop_reason'],
): Anthropic.Message =>
  ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'anthropic.claude-opus-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage,
  }) as Anthropic.Message;

const toolUse = (id: string, name: string, input: unknown): Anthropic.ToolUseBlock =>
  ({ type: 'tool_use', id, name, input }) as Anthropic.ToolUseBlock;

const text = (value: string): Anthropic.TextBlock =>
  ({ type: 'text', text: value, citations: null }) as Anthropic.TextBlock;

/**
 * The assistant keeps appending to one messages array across calls, so each call's request is
 * snapshotted here; `calls[n][0]` is then what the model actually received on call n.
 */
interface ScriptedClient {
  client: ClaudeMessagesClient;
  create: { mock: { calls: Array<[Anthropic.MessageCreateParamsNonStreaming]> } };
}

const scriptedClient = (responses: Anthropic.Message[]): ScriptedClient => {
  const calls: Array<[Anthropic.MessageCreateParamsNonStreaming]> = [];
  const create = vi.fn(async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    calls.push([structuredClone(params)]);
    const next = responses.shift();
    if (!next) throw new Error('No scripted response left');
    return next;
  });
  const client: ClaudeMessagesClient = { messages: { create } };
  return { client, create: { mock: { calls } } };
};

const baseInput = {
  messages: [{ role: 'user' as const, text: 'Two dogs from 12 to 15 October please' }],
  needs: createEmptyNeeds(),
  locale: 'en' as const,
  today: TODAY,
  describeOptions: vi.fn(async () => ({
    ready: false,
    missingFields: ['size' as const],
    combos: [],
    services: { rooms: [], foods: [], addons: [] },
  })),
};

describe('ClaudeConciergeAssistant', () => {
  it('records needs through the tool and returns the final text', async () => {
    const { client, create } = scriptedClient([
      message(
        [
          toolUse('tool_1', 'record_booking_needs', {
            service: 'boarding',
            startDate: '2026-10-12',
            endDate: '2026-10-15',
            petCount: 2,
            pets: [
              { index: 0, species: 'dog' },
              { index: 1, species: 'dog' },
            ],
          }),
        ],
        'tool_use',
      ),
      message([text('Lovely! Are they small, medium or large?')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    const result = await assistant.respond(baseInput);
    const needs = result.needsPatches.reduce(mergeNeeds, createEmptyNeeds());

    expect(result.reply).toBe('Lovely! Are they small, medium or large?');
    expect(needs.pets).toHaveLength(2);
    expect(needs.startDate).toBe('2026-10-12');
    // The context block the website adds is separate from the guest's own words.
    const firstCall = create.mock.calls[0] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
    ];
    const lastUser = firstCall[0].messages.at(-1);
    expect(Array.isArray(lastUser?.content) && lastUser.content.length).toBe(2);
  });

  it('names the brand and asks for plain punctuation', async () => {
    const { client, create } = scriptedClient([
      message([text('How many pets are coming?')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    await assistant.respond(baseInput);

    const system = String(create.mock.calls[0]?.[0].system);
    expect(system).toContain('booking concierge for Wagstay');
    expect(system).toContain('Use plain punctuation. Never use em dashes or en dashes.');
    expect(system).toContain(CHAT_FORMATTING_RULE);
  });

  it('removes dashes from the notes staff will read', async () => {
    const { client } = scriptedClient([
      message(
        [
          toolUse('tool_1', 'record_booking_needs', {
            notes: 'Shy at first \u2014 give her time.',
          }),
        ],
        'tool_use',
      ),
      message([text('Noted. How many pets are coming?')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    const result = await assistant.respond(baseInput);

    expect(result.needsPatches).toEqual([{ notes: 'Shy at first, give her time.' }]);
  });

  it('rejects an invalid tool input instead of merging it', async () => {
    const { client, create } = scriptedClient([
      message(
        [toolUse('tool_1', 'record_booking_needs', { petCount: 2, price: 1, isAdmin: true })],
        'tool_use',
      ),
      message([text('How many pets are coming?')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    const result = await assistant.respond(baseInput);

    expect(result.needsPatches).toEqual([]);
    const secondCall = create.mock.calls[1] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
    ];
    const toolResult = secondCall[0].messages.at(-1)?.content;
    expect(JSON.stringify(toolResult)).toContain('"is_error":true');
  });

  it('gives combo contents to the model without prices', async () => {
    const describeOptions = vi.fn(async () => ({
      ready: true,
      missingFields: [],
      combos: [
        {
          id: 'combo-simple',
          name: 'Cosy room and House food',
          includesByPet: [['Cosy room', 'House food']],
          reason: 'Everything you asked for.',
          recommended: true,
        },
      ],
      services: { rooms: ['Cosy room'], foods: ['House food'], addons: [] },
    }));
    const { client, create } = scriptedClient([
      message([toolUse('tool_1', 'get_stay_options', {})], 'tool_use'),
      message([text('Your options are ready in the panel.')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    await assistant.respond({ ...baseInput, describeOptions });

    const secondCall = create.mock.calls[1] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
    ];
    const toolResult = JSON.stringify(secondCall[0].messages.at(-1)?.content);
    expect(toolResult).toContain('Cosy room');
    expect(toolResult).not.toMatch(/price|total|\$/i);
  });

  it('answers a refusal with the fixed decline message', async () => {
    const { client } = scriptedClient([message([], 'refusal')]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    const result = await assistant.respond(baseInput);

    expect(result.reply).toMatch(/only help with planning a stay/);
  });

  it('turns an API failure into an unavailable error without logging the conversation', async () => {
    const log = vi.fn();
    const create = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const assistant = new ClaudeConciergeAssistant({
      client: { messages: { create } },
      model: 'm',
      effort: 'low',
      log,
    });

    await expect(assistant.respond(baseInput)).rejects.toBeInstanceOf(
      ConciergeAssistantUnavailableError,
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('Two dogs');
  });

  it('stops a model that keeps calling tools', async () => {
    const loop = Array.from({ length: 5 }, (_unused, index) =>
      message([toolUse(`tool_${index}`, 'get_stay_options', {})], 'tool_use'),
    );
    const { client } = scriptedClient(loop);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    await expect(assistant.respond(baseInput)).rejects.toBeInstanceOf(
      ConciergeAssistantUnavailableError,
    );
  });
});

describe('policy questions', () => {
  it('reads the rules through get_booking_rules and never answers from memory', async () => {
    const { client, create } = scriptedClient([
      message([toolUse('tool_rules', 'get_booking_rules', {})], 'tool_use'),
      message(
        [
          text(
            'Cancelling 7 days or more before drop-off is free; closer than that a fee applies.',
          ),
        ],
        'end_turn',
      ),
    ]);
    const describeRules = vi.fn(async () => 'Free cancellation until 7 days before drop-off.');
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    const result = await assistant.respond({
      ...baseInput,
      messages: [{ role: 'user', text: 'What if I need to cancel?' }],
      describeRules,
    });

    expect(describeRules).toHaveBeenCalledTimes(1);
    const toolNames = (create.mock.calls[0]?.[0].tools ?? []).map((tool) =>
      'name' in tool ? tool.name : '',
    );
    expect(toolNames).toContain('get_booking_rules');
    const secondCall = create.mock.calls[1]?.[0];
    const toolResult = secondCall?.messages.at(-1)?.content;
    expect(JSON.stringify(toolResult)).toContain('Free cancellation until 7 days');
    expect(result.reply).toContain('Cancelling 7 days or more');
    expect(result.needsPatches).toEqual([]);
  });

  it('tells the model to send the guest to the team when the rules cannot be read', async () => {
    const { client, create } = scriptedClient([
      message([toolUse('tool_rules', 'get_booking_rules', {})], 'tool_use'),
      message([text('I am not sure; our team can confirm the cancellation rules.')], 'end_turn'),
    ]);
    const assistant = new ClaudeConciergeAssistant({ client, model: 'm', effort: 'low' });

    await assistant.respond({
      ...baseInput,
      messages: [{ role: 'user', text: 'What if I need to cancel?' }],
    });

    const toolResult = create.mock.calls[1]?.[0].messages.at(-1)?.content;
    expect(JSON.stringify(toolResult)).toContain('not available; send the guest to our team');
  });
});
