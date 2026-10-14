import { afterEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { DoseRecord } from '../contracts/medication.contract.js';
import { composeDailyUpdate, type DayFacts } from '../services/daily-summary.compose.js';
import {
  BedrockUpdateWriter,
  checkWarmUpdate,
  warmDailyUpdate,
  type WarmUpdateInput,
} from '../services/daily-summary.writer.js';

const dose = (over: Partial<DoseRecord>): DoseRecord => ({
  id: 'd1',
  medicationId: 'm1',
  medicineName: 'Apoquel',
  dose: 1,
  unit: 'tablet',
  slot: 'morning',
  dueAt: '2026-12-13T08:00:00+13:00',
  status: 'given',
  givenAt: '2026-12-13T08:05:00+13:00',
  givenBy: null,
  reason: null,
  ...over,
});

const facts: DayFacts = {
  petName: 'Bella',
  dayLabel: 'Sun 13 Dec',
  feedsDone: 2,
  feedsPlanned: 2,
  walksDone: 1,
  playDone: 0,
  otherDone: [],
  photos: 3,
  videos: 0,
  weightKg: null,
  toiletDone: 0,
  doses: [
    dose({}),
    dose({
      id: 'd2',
      medicationId: 'm2',
      medicineName: 'Metacam',
      slot: 'evening',
      status: 'not_given',
      givenAt: null,
      reason: 'she refused it',
    }),
  ],
  notes: [],
};

const inputFor = (locale: 'en' | 'zh' = 'en'): WarmUpdateInput => ({
  facts,
  locale,
  record: composeDailyUpdate(facts, locale),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkWarmUpdate', () => {
  it('accepts a rewording that keeps to the record', () => {
    const note =
      'Bella had a lovely Sunday. She ate both of her 2 planned meals and went out for 1 walk. ' +
      'She had her Apoquel in the morning at 8:05 am; her Metacam was not given, she refused it. We took 3 photos for you.';
    expect(checkWarmUpdate(note, inputFor())).toEqual([]);
  });

  it('refuses a number the record does not have, and a medicine claimed given without a record', () => {
    const extra = 'Bella had 2 meals, 1 walk and 4 photos today.';
    expect(checkWarmUpdate(extra, inputFor())).toContain('number not in record: 4');
    const claimed = 'Bella had her Apoquel and her Metacam today, 2 meals and 1 walk, 3 photos.';
    expect(checkWarmUpdate(claimed, inputFor())).toContain('dose claimed given: Metacam');
  });

  it('refuses a note that forgets the pet, adds a link, is too long or is in the wrong language', () => {
    expect(checkWarmUpdate('A lovely day with 2 meals.', inputFor())).toContain('pet not named');
    expect(checkWarmUpdate('Bella: see https://example.test', inputFor())).toContain(
      'link or address',
    );
    expect(checkWarmUpdate(`Bella ${'x'.repeat(800)}`, inputFor())).toContain('too long');
    expect(checkWarmUpdate('Bella had a lovely day with 2 meals.', inputFor('zh'))).toContain(
      'not in Chinese',
    );
    expect(checkWarmUpdate('Bella今天很开心，吃了2餐。', inputFor())).toContain('not in English');
  });

  it('accepts a Chinese note that keeps the record', () => {
    const note =
      'Bella今天过得很好，吃完了计划的2餐，散步了1次。早上8:05给了Apoquel，Metacam没有给（she refused it）。拍了3张照片。';
    expect(checkWarmUpdate(note, inputFor('zh'))).toEqual([]);
  });
});

describe('warmDailyUpdate', () => {
  const record = composeDailyUpdate(facts, 'en');

  it('sends the record when no writer is configured', async () => {
    await expect(warmDailyUpdate(facts, 'en', record, null)).resolves.toEqual({
      body: record,
      writtenBy: 'record',
    });
  });

  it("sends the model's note when it passes the check", async () => {
    const note =
      'Bella had a lovely Sunday with 2 meals and 1 walk, her Apoquel at 8:05 am, 1 dose to come and 3 photos.';
    await expect(
      warmDailyUpdate(facts, 'en', record, { write: async () => note }),
    ).resolves.toEqual({
      body: note,
      writtenBy: 'model',
    });
  });

  it('falls back to the record, logging no words, when the note strays or the model fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const strayed = await warmDailyUpdate(facts, 'en', record, {
      write: async () => 'Bella had 5 walks and her Metacam.',
    });
    expect(strayed).toEqual({ body: record, writtenBy: 'record' });
    const failed = await warmDailyUpdate(facts, 'en', record, {
      write: async () => {
        throw new Error('throttled');
      },
    });
    expect(failed).toEqual({ body: record, writtenBy: 'record' });
    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain('Bella');
    expect(logged).not.toContain('Metacam');
  });
});

describe('BedrockUpdateWriter', () => {
  it('asks for the parent’s language, sends the record alone and strips dashes from the answer', async () => {
    const create = vi.fn<
      (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>
    >(
      async () =>
        ({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          model: 'test',
          content: [{ type: 'text', text: 'Bella had a good day — 2 meals.', citations: null }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }) as unknown as Anthropic.Message,
    );
    const writer = new BedrockUpdateWriter({ messages: { create } }, 'test-model');
    const note = await writer.write(inputFor('zh'));
    expect(note).toBe('Bella had a good day, 2 meals.');
    const params = create.mock.calls[0]?.[0];
    if (!params) throw new Error('the model was not called');
    expect(params.model).toBe('test-model');
    expect(String(params.system)).toContain('Chinese');
    expect(params.messages).toEqual([{ role: 'user', content: inputFor('zh').record }]);
  });
});
