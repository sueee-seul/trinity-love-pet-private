import { describe, expect, it } from 'vitest';
import type { ConciergeChatMessage, ConciergeNeeds } from '../contracts/concierge.contract.js';
import type {
  AssistantTurnResult,
  ComboDescription,
  ServiceNamesByRole,
} from '../services/concierge/concierge.assistant.js';
import { RulesConciergeAssistant } from '../services/concierge/concierge.rules-assistant.js';
import {
  createEmptyNeeds,
  createEmptyPet,
  mergeNeeds,
} from '../services/concierge/concierge.needs.js';
import {
  detectAmbiguousCare,
  extractDateRange,
} from '../services/concierge/concierge.rules-extract.js';
import { TODAY } from './fixtures/concierge.fixtures.js';

const NO_SERVICES: ServiceNamesByRole = { rooms: [], foods: [], addons: [] };

/** What the server would suggest for a dog on medication: the roomier stay is the fit. */
const READY_COMBOS: ComboDescription[] = [
  {
    id: 'combo-simple',
    name: 'Cosy room and House food',
    includesByPet: [['Cosy room', 'House food']],
    reason: 'Everything you asked for and nothing more.',
    recommended: false,
  },
  {
    id: 'combo-roomier',
    name: 'Garden suite and Premium food',
    includesByPet: [['Garden suite', 'Premium food']],
    reason: 'A roomier suite, which suits a pet on medication or a first stay.',
    recommended: true,
  },
];

const assistant = new RulesConciergeAssistant();

const reply = async (
  text: string,
  locale: 'en' | 'zh' = 'en',
): Promise<AssistantTurnResult & { needs: ConciergeNeeds }> => {
  const messages: ConciergeChatMessage[] = [{ role: 'user', text }];
  const result = await assistant.respond({
    messages,
    needs: createEmptyNeeds(),
    locale,
    today: TODAY,
    describeOptions: async () => ({
      ready: false,
      missingFields: [],
      combos: [],
      services: NO_SERVICES,
    }),
  });
  return { ...result, needs: result.needsPatches.reduce(mergeNeeds, createEmptyNeeds()) };
};

describe('extractDateRange', () => {
  it('reads ISO dates', () => {
    expect(extractDateRange('from 2026-10-12 to 2026-10-15', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
  });

  it('reads New Zealand day/month dates as the next occurrence', () => {
    expect(extractDateRange('12/10 - 15/10', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
    expect(extractDateRange('3/1 to 6/1', TODAY)).toEqual({
      startDate: '2027-01-03',
      endDate: '2027-01-06',
    });
  });

  it('reads Chinese dates, including a shortened end date', () => {
    expect(extractDateRange('10月12日到15日', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
    expect(extractDateRange('10月12日\u201415日', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
  });

  it('ignores impossible dates', () => {
    expect(extractDateRange('31/02 to 02/03', TODAY)).toBeNull();
  });

  it.each([
    '12 to 15 October',
    '12-15 Oct',
    '12th October to 15th October',
    'from the 12th of October to the 15th of October',
    'from the 12th of October to the 15th',
    'October 12 to 15',
    'Oct 12th - Oct 15th',
    'october the 12th until the 15th',
    // Guests type en and em dashes too, often pasted from a calendar.
    '12\u201315 Oct',
    'Oct 12 \u2014 Oct 15',
  ])('reads English month names and ordinals: %s', (text) => {
    expect(extractDateRange(text, TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
  });

  it('reads a stay that crosses into the next month and year', () => {
    expect(extractDateRange('28 Dec to 3 Jan', TODAY)).toEqual({
      startDate: '2026-12-28',
      endDate: '2027-01-03',
    });
  });

  it.each([
    ['from 12 October for 3 nights', '2026-10-15'],
    ['12/10 for three nights', '2026-10-15'],
    ['October 12th, a week', '2026-10-19'],
    ['10月12日开始住3晚', '2026-10-15'],
    ['10月12日住一周', '2026-10-19'],
  ])('reads a start date plus a length of stay: %s', (text, endDate) => {
    expect(extractDateRange(text, TODAY)).toEqual({ startDate: '2026-10-12', endDate });
  });

  it('does not turn "days" into nights, because that changes the price', () => {
    expect(extractDateRange('10月12日住3天', TODAY)).toBeNull();
  });

  it('never guesses relative dates', () => {
    expect(extractDateRange('next weekend for 3 nights', TODAY)).toBeNull();
  });
});

describe('detectAmbiguousCare', () => {
  const twoPets = (species: ['dog' | 'cat', 'dog' | 'cat']): ConciergeNeeds => ({
    ...createEmptyNeeds(),
    pets: species.map((kind) => ({
      species: kind,
      size: null,
      needsMedication: null,
      firstTimeBoarding: null,
    })),
  });

  it('flags "one needs medication" when there are several pets', () => {
    expect(detectAmbiguousCare('one needs medication', twoPets(['dog', 'dog']))).toEqual([
      'medication',
    ]);
    expect(detectAmbiguousCare('其中一只要吃药', twoPets(['cat', 'cat']))).toEqual(['medication']);
  });

  it('does not flag a detail that covers every pet or names the only pet of a species', () => {
    expect(detectAmbiguousCare('both need medication', twoPets(['dog', 'dog']))).toEqual([]);
    expect(detectAmbiguousCare('the cat needs medication', twoPets(['dog', 'cat']))).toEqual([]);
  });
});

describe('RulesConciergeAssistant', () => {
  it('understands a full English request and says packages are ready', async () => {
    const result = await reply('I need boarding for 2 large dogs from 12/10 to 15/10, with walks');

    expect(result.needs.service).toBe('boarding');
    expect(result.needs.pets).toHaveLength(2);
    expect(result.needs.pets.every((pet) => pet.species === 'dog' && pet.size === 'large')).toBe(
      true,
    );
    expect(result.needs.extras.walks).toBe(true);
    expect(result.reply).toMatch(/suggested stays for you/);
  });

  it('understands Chinese and asks the next question in Chinese', async () => {
    const result = await reply('两只猫 10月12日到15日 寄养', 'zh');

    expect(result.needs.pets.map((pet) => pet.species)).toEqual(['cat', 'cat']);
    expect(result.reply).toMatch(/方案/);
  });

  it('shows the options without waiting for the dog size, then asks for it once', async () => {
    const result = await reply('boarding for one dog 12/10 to 15/10');

    expect(result.reply).toMatch(/suggested stays for you/);
    expect(result.reply).toMatch(/small, medium or large/);
  });

  it('keeps free text about the pet as a note for staff instead of dropping it', async () => {
    const result = await reply('She gets very scared of thunder storms');

    expect(result.needs.notes).toBe('She gets very scared of thunder storms');
    expect(result.reply).toMatch(/added it to your notes for our team/);
  });

  it('treats a bare "yes" after the service question as yes', async () => {
    const result = await assistant.respond({
      messages: [
        { role: 'user', text: 'hello' },
        {
          role: 'assistant',
          text: 'Happy to help. Right now we take boarding bookings online. Shall I plan a boarding stay for you?',
        },
        { role: 'user', text: 'yes please' },
      ],
      needs: createEmptyNeeds(),
      locale: 'en',
      today: TODAY,
      describeOptions: async () => ({
        ready: false,
        missingFields: [],
        combos: [],
        services: NO_SERVICES,
      }),
    });

    expect(result.needsPatches).toContainEqual({ service: 'boarding' });
  });

  it('handles the example shown in the chat box without pricing medication for both dogs', async () => {
    const result = await reply('two dogs, 12 to 15 October, one needs medication');

    expect(result.needs.startDate).toBe('2026-10-12');
    expect(result.needs.endDate).toBe('2026-10-15');
    expect(result.needs.pets.map((pet) => pet.needsMedication)).toEqual([null, null]);
    expect(result.reply).toMatch(/^Which pet takes medication\?/);
  });

  it('puts medication only on the pet the guest named', async () => {
    const result = await reply('a dog and a cat, 12/10 to 15/10, the cat needs medication');

    expect(result.needs.pets.map((pet) => [pet.species, pet.needsMedication])).toEqual([
      ['dog', null],
      ['cat', true],
    ]);
  });

  it('says when it understood nothing', async () => {
    const result = await reply('hmm');

    expect(result.needsPatches).toEqual([]);
    expect(result.reply).toMatch(/^I did not quite catch that\./);
  });
});

describe('size words', () => {
  it('never gives two dogs the same size when the guest named two sizes', async () => {
    const result = await reply('two dogs 12/10 to 15/10, one is large, one is small');

    expect(result.needs.pets.map((pet) => pet.size)).toEqual([null, null]);
  });
});

describe('review fixes: misreadings that changed the quote', () => {
  const needsWith = (overrides: Partial<ConciergeNeeds>): ConciergeNeeds => ({
    ...createEmptyNeeds(),
    service: 'boarding',
    ...overrides,
  });
  const dogAndCat = needsWith({
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    pets: [
      { species: 'dog', size: 'large', needsMedication: null, firstTimeBoarding: null },
      { species: 'cat', size: null, needsMedication: null, firstTimeBoarding: null },
    ],
  });
  const turn = async (
    text: string,
    needs: ConciergeNeeds,
    history: ConciergeChatMessage[] = [],
    locale: 'en' | 'zh' = 'en',
  ): Promise<AssistantTurnResult & { needs: ConciergeNeeds }> => {
    const result = await assistant.respond({
      messages: [...history, { role: 'user', text }],
      needs,
      locale,
      today: TODAY,
      describeOptions: async () => ({
        ready: false,
        missingFields: [],
        combos: [],
        services: NO_SERVICES,
      }),
    });
    return { ...result, needs: result.needsPatches.reduce(mergeNeeds, needs) };
  };

  it.each([
    "She doesn't need any medication",
    '不需要吃药',
    "he's not on meds",
    'none of them need medication',
    '不需要用药',
  ])('never reads a "no medication" sentence as a yes: %s', async (text) => {
    const result = await turn(text, dogAndCat);
    expect(result.needs.pets.some((pet) => pet.needsMedication === true)).toBe(false);
  });

  it('puts medication on the pet the guest means, or asks', async () => {
    expect(
      (await turn('My dog needs medication twice a day', dogAndCat)).needs.pets.map(
        (p) => p.needsMedication,
      ),
    ).toEqual([true, null]);
    expect(
      (await turn('our cat takes insulin', dogAndCat)).needs.pets.map((p) => p.needsMedication),
    ).toEqual([null, true]);
    const unclear = await turn('needs medication', dogAndCat);
    expect(unclear.needs.pets.map((p) => p.needsMedication)).toEqual([null, null]);
    expect(unclear.reply).toMatch(/Which pet takes medication/);
  });

  it('understands the answer to "which pet?"', async () => {
    const asked = await turn('one of them needs medication', dogAndCat);
    const answered = await turn('the cat', dogAndCat, [
      { role: 'user', text: 'one of them needs medication' },
      { role: 'assistant', text: asked.reply },
    ]);
    expect(answered.needs.pets.map((p) => p.needsMedication)).toEqual([false, true]);
  });

  it('does not read fractions, 24/7 or year-first dates as the stay', () => {
    expect(
      extractDateRange('She eats 1/2 cup in the morning and 1/4 cup at night', TODAY),
    ).toBeNull();
    expect(extractDateRange('2026/11/01 to 2026/11/03', TODAY)).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });
    expect(extractDateRange('12/10/2027 - 15/10/2027', TODAY)).toEqual({
      startDate: '2027-10-12',
      endDate: '2027-10-15',
    });
    expect(extractDateRange('From 12/10 for 3 nights, needs 24/7 care', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
  });

  it('keeps dates already chosen when a care note happens to contain numbers', async () => {
    const result = await turn('Please give her 1/2 a tablet, she weighs 12.5kg', dogAndCat);
    expect(result.needs.startDate).toBe('2026-10-12');
    expect(result.needs.endDate).toBe('2026-10-15');
  });

  it('reads Chinese dates written with the year', () => {
    expect(extractDateRange('2026年10月12日到2026年10月15日', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
    });
  });

  it('reads mixed month orders and ignores counts after a date', () => {
    expect(extractDateRange('October 12 to 15 November', TODAY)).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-11-15',
    });
    expect(extractDateRange('2 October - 3 dogs, 4 nights', TODAY)).toEqual({
      startDate: '2026-10-02',
      endDate: '2026-10-06',
    });
  });

  it('fills in an open species without shrinking the pet list', async () => {
    const needs = needsWith({
      pets: [
        { species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null },
        { species: null, size: null, needsMedication: null, firstTimeBoarding: null },
      ],
    });
    const result = await turn('and the other one is a cat', needs);
    expect(result.needs.pets.map((pet) => pet.species)).toEqual(['dog', 'cat']);
  });

  it('understands a Chinese "yes" to the service question, even after a missed message', async () => {
    const result = await assistant.respond({
      messages: [
        { role: 'user', text: '你好' },
        {
          role: 'assistant',
          text: '这句我没太理解，也可以直接点下面的选项。 很乐意帮你安排。目前线上可以预约寄养，要我帮你规划一次寄养吗？',
        },
        { role: 'user', text: '好的' },
      ],
      needs: createEmptyNeeds(),
      locale: 'zh',
      today: TODAY,
      describeOptions: async () => ({
        ready: false,
        missingFields: [],
        combos: [],
        services: NO_SERVICES,
      }),
    });
    expect(result.needsPatches).toContainEqual({ service: 'boarding' });
  });
});

describe('RulesConciergeAssistant plans', () => {
  const ready: ConciergeNeeds = {
    ...createEmptyNeeds(),
    service: 'boarding',
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    pets: [{ ...createEmptyPet(), species: 'dog', size: 'large', needsMedication: true }],
  };
  const respond = (text: string, locale: 'en' | 'zh' = 'en'): Promise<AssistantTurnResult> =>
    assistant.respond({
      messages: [{ role: 'user', text }],
      needs: ready,
      locale,
      today: TODAY,
      describeOptions: async () => ({
        ready: true,
        missingFields: [],
        combos: READY_COMBOS,
        services: NO_SERVICES,
      }),
    });

  it('names the combo that fits once the options are ready, with no plan before that', async () => {
    const result = await respond('ok');
    expect(result.plan).toMatchObject({
      recommendedComboId: 'combo-roomier',
      bookRequested: false,
    });
    expect(result.reply).toContain('suits a pet on medication');

    const early = await reply('a dog');
    expect(early.plan ?? null).toBeNull();
  });

  it('hands the form over on "book it for me" and tells the guest confirming is still theirs', async () => {
    const result = await respond('帮我订推荐的方案', 'zh');
    expect(result.plan).toMatchObject({ recommendedComboId: 'combo-roomier', bookRequested: true });
    // The instruction is acted on, not written into the notes staff read.
    expect(result.needsPatches.some((patch) => 'notes' in patch)).toBe(false);
    const english = await respond('Book the recommended stay for me');
    expect(english.plan).toMatchObject({ bookRequested: true });
    expect(english.needsPatches).toEqual([]);
    expect(result.reply).toContain('Garden suite and Premium food');
    expect(result.reply).toContain('确认预订');
  });
});

describe('fee and terms questions in rules mode', () => {
  it('points to the rules on the page instead of guessing, then asks the next question', async () => {
    const result = await reply('What happens if I need to cancel the booking?');
    expect(result.reply).toMatch(/can’t answer questions about fees or terms in basic mode/);
    expect(result.reply).toContain('full booking terms are on this page');
    // A policy question is not a care note for staff.
    expect(result.needs.notes).toBe('');
  });

  it('does the same in Chinese', async () => {
    const result = await reply('取消预约要收费吗？', 'zh');
    expect(result.reply).toContain('基础模式下我无法回答费用或条款方面的问题');
    expect(result.needs.notes).toBe('');
  });
});
