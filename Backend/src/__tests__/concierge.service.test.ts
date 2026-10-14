import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  ConciergeChatRequest,
  ConciergeLastStay,
  ConciergeNeeds,
} from '../contracts/concierge.contract.js';
import {
  ConciergeAssistantUnavailableError,
  type ConciergeAssistant,
} from '../services/concierge/concierge.assistant.js';
import { RulesConciergeAssistant } from '../services/concierge/concierge.rules-assistant.js';
import { createEmptyNeeds } from '../services/concierge/concierge.needs.js';
import {
  acceptConciergeQuote,
  getConciergeRates,
  priceConciergeSelection,
  runConciergeTurn,
  type ConciergeServiceDependencies,
} from '../services/concierge/concierge.service.js';
import type { BookingServiceRecord } from '../repositories/petparent.booking.repository.js';
import { verifyAcceptedQuote, verifyQuote } from '../services/concierge/concierge.tokens.js';
import {
  CATALOGUE,
  readyNeeds,
  TEST_SIGNING_SECRET,
  TODAY,
} from './fixtures/concierge.fixtures.js';

/** Relative to now: accepted-quote tokens expire after an hour, so a fixed date would rot. */
const ACCEPTED_AT = new Date(Date.now() - 60_000);

const dependencies = (
  assistant: ConciergeAssistant,
  fullNights: string[] = [],
): ConciergeServiceDependencies => ({
  assistant,
  loadCatalogue: async (): Promise<BookingServiceRecord[]> => CATALOGUE,
  today: (): string => TODAY,
  findFullNights: async (): Promise<string[]> => fullNights,
});

const request = (overrides: Partial<ConciergeChatRequest> = {}): ConciergeChatRequest => ({
  messages: [{ role: 'user', text: 'boarding for one large dog 12/10 to 15/10' }],
  needs: createEmptyNeeds(),
  locale: 'en',
  trigger: 'message',
  ...overrides,
});

describe('runConciergeTurn', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  it('returns signed combos and the catalogue once the needs are complete', async () => {
    const response = await runConciergeTurn(request(), dependencies(new RulesConciergeAssistant()));

    const recommended = response.combos.find((combo) => combo.recommended);
    expect(response.plan).toMatchObject({
      recommendedComboId: recommended?.id,
      bookRequested: false,
    });
    expect(response.combos.filter((combo) => combo.recommended)).toHaveLength(1);
    expect(response.catalogue.rooms.map((room) => room.name)).toEqual([
      'Cosy room',
      'Garden suite',
      'Royal suite',
    ]);

    expect(response.missingFields).toEqual([]);
    expect(response.assistantMode).toBe('rules');
    expect(response.combos).toHaveLength(3);
    expect(response.combos[0]?.quote.name).toBe('Cosy room and House food');
    const signed = await verifyQuote(response.combos[0]?.quote.quoteToken ?? '');
    expect(signed.total).toBe(response.combos[0]?.quote.total);
    expect(signed.selection).toEqual(response.combos[0]?.quote.selection);
    expect(
      response.combos.every((combo) => combo.quote.gstInclusive && combo.quote.currency === 'NZD'),
    ).toBe(true);
  });

  it('asks the next question and offers nothing while details are missing', async () => {
    const response = await runConciergeTurn(
      request({ messages: [{ role: 'user', text: 'hello' }] }),
      dependencies(new RulesConciergeAssistant()),
    );

    expect(response.combos).toEqual([]);
    expect(response.missingFields).toEqual(['service', 'dates', 'pets']);
  });

  it('answers with the rules assistant, and still quotes, when the model is unavailable', async () => {
    const failing: ConciergeAssistant = {
      mode: 'claude',
      respond: async () => {
        throw new ConciergeAssistantUnavailableError('down');
      },
    };

    const response = await runConciergeTurn(
      request({ needs: readyNeeds() }),
      dependencies(failing),
    );

    // The rules assistant answers the turn, so the guest is never told to wait.
    expect(response.assistantAvailable).toBe(true);
    expect(response.assistantMode).toBe('rules');
    expect(response.reply).not.toMatch(/cannot reply right now/);
    expect(response.combos).toHaveLength(3);
    expect(response.plan?.recommendedComboId).toBeTruthy();
  });

  it('reports the outage only when the rules assistant itself is the one that fails', async () => {
    const failingRules: ConciergeAssistant = {
      mode: 'rules',
      respond: async () => {
        throw new ConciergeAssistantUnavailableError('down');
      },
    };

    const response = await runConciergeTurn(
      request({ needs: readyNeeds() }),
      dependencies(failingRules),
    );

    expect(response.assistantAvailable).toBe(false);
    expect(response.reply).toMatch(/cannot reply right now/);
    expect(response.combos).toHaveLength(3);
  });

  it('strips prices a model writes into its reply', async () => {
    const chatty: ConciergeAssistant = {
      mode: 'claude',
      respond: async () => ({ reply: 'The suite is only $85 a night!', needsPatches: [] }),
    };

    const response = await runConciergeTurn(request({ needs: readyNeeds() }), dependencies(chatty));

    expect(response.reply).not.toContain('85');
  });

  it('refreshes combos for a checklist change without asking the assistant', async () => {
    const respond = async (): Promise<never> => {
      throw new Error('the assistant must not be called for a checklist change');
    };

    const response = await runConciergeTurn(
      request({ needs: readyNeeds(), trigger: 'checklist' }),
      dependencies({ mode: 'claude', respond }),
    );

    expect(response.reply).toBe('');
    expect(response.assistantAvailable).toBe(true);
    expect(response.combos).toHaveLength(3);
  });

  it('checks the planned stay for room before pricing it', async () => {
    const stays: unknown[] = [];
    const response = await runConciergeTurn(request({ needs: readyNeeds() }), {
      ...dependencies(new RulesConciergeAssistant()),
      findFullNights: async (stay) => {
        stays.push(stay);
        return [];
      },
    });

    expect(stays).toEqual([{ startDate: '2026-10-12', endDate: '2026-10-15', petCount: 1 }]);
    expect(response.fullNights).toEqual([]);
    expect(response.combos).toHaveLength(3);
  });

  it('offers no options and names the full nights when the stay does not fit', async () => {
    const response = await runConciergeTurn(
      request({ needs: readyNeeds() }),
      dependencies(new RulesConciergeAssistant(), ['2026-10-13', '2026-10-14']),
    );

    expect(response.combos).toEqual([]);
    expect(response.fullNights).toEqual(['2026-10-13', '2026-10-14']);
    expect(response.reply).toBe(
      'Sorry, we are full on 13 Oct and 14 Oct. Please try other dates and I will price them for you.',
    );
  });

  it('names full nights in Chinese for a Chinese guest', async () => {
    const response = await runConciergeTurn(
      request({ needs: readyNeeds(), locale: 'zh' }),
      dependencies(new RulesConciergeAssistant(), ['2026-10-13']),
    );

    expect(response.reply).toBe('抱歉，10月13日已经住满了。换个日期试试，我再帮你报价。');
  });

  it('keeps a checklist refresh silent when nights are full', async () => {
    const response = await runConciergeTurn(
      request({ needs: readyNeeds(), trigger: 'checklist' }),
      dependencies(new RulesConciergeAssistant(), ['2026-10-13']),
    );

    expect(response.reply).toBe('');
    expect(response.fullNights).toEqual(['2026-10-13']);
    expect(response.combos).toEqual([]);
  });

  it('answers a tapped choice with the next fixed question and no model call', async () => {
    const respond = async (): Promise<never> => {
      throw new Error('the assistant must not be called for a tapped answer');
    };
    const needs = { ...readyNeeds(), startDate: null, endDate: null };

    const response = await runConciergeTurn(
      request({ messages: [{ role: 'user', text: '1 dog' }], needs, trigger: 'choice' }),
      dependencies({ mode: 'claude', respond }),
    );

    expect(response.reply).toMatch(/Which dates/);
    expect(response.combos).toEqual([]);
  });

  it('announces ready options once, then only says they were updated', async () => {
    const assistant = new RulesConciergeAssistant();
    const first = await runConciergeTurn(
      request({ needs: readyNeeds(), trigger: 'choice' }),
      dependencies(assistant),
    );
    const again = await runConciergeTurn(
      request({
        messages: [
          { role: 'user', text: '1 dog' },
          { role: 'assistant', text: first.reply },
          { role: 'user', text: 'No medication' },
        ],
        needs: readyNeeds(),
        trigger: 'choice',
      }),
      dependencies(assistant),
    );

    expect(first.reply).toMatch(/suggested stays for you/);
    expect(again.reply).toBe('Done. Your stay is updated.');
    expect(again.combos).toHaveLength(3);
  });

  it('does not swallow unexpected errors', async () => {
    const broken: ConciergeAssistant = {
      mode: 'rules',
      respond: async () => {
        throw new TypeError('bug');
      },
    };

    await expect(runConciergeTurn(request(), dependencies(broken))).rejects.toThrow('bug');
  });
});

describe('runConciergeTurn with "same as last time"', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  const lastStay: ConciergeLastStay = {
    confirmationNumber: 'PB-ABC123',
    startDate: '2026-09-10',
    endDate: '2026-09-13',
    needs: {
      ...readyNeeds(),
      startDate: null,
      endDate: null,
      pets: [
        {
          name: 'Luna',
          species: 'cat',
          size: null,
          needsMedication: true,
          firstTimeBoarding: false,
        },
      ],
    },
    selection: {
      pets: [
        {
          roomId: '11111111-1111-4111-8111-000000000002',
          foodId: '11111111-1111-4111-8111-000000000004',
          addonIds: ['11111111-1111-4111-8111-000000000008'],
        },
      ],
    },
    savedPetIds: ['00000000-0000-4000-8000-000000000401'],
  };
  const sameAsLastTime = (
    locale: 'en' | 'zh' = 'en',
    needs = createEmptyNeeds(),
  ): ConciergeChatRequest =>
    request({
      messages: [{ role: 'user', text: locale === 'zh' ? '和上次一样' : 'Same as last time' }],
      needs,
      locale,
    });
  const neverCalled = async (): Promise<never> => {
    throw new Error('the assistant must not be called for a copied stay');
  };

  it('copies the pets and services for a signed-in parent and asks for the dates', async () => {
    const response = await runConciergeTurn(sameAsLastTime(), {
      ...dependencies({ mode: 'claude', respond: neverCalled }),
      ownerId: 'owner-1',
      readLastStay: async () => lastStay,
    });

    expect(response.needs.pets).toEqual(lastStay.needs.pets);
    expect(response.needs.service).toBe('boarding');
    expect(response.needs.startDate).toBeNull();
    expect(response.reply).toMatch(/copied the stay Luna had with us from 10 Sept? 2026/);
    expect(response.reply).toMatch(/Which dates/);
    expect(response.lastStay).toEqual(lastStay);
    expect(response.combos).toEqual([]);
  });

  it('keeps dates the guest already gave and prices the copied stay at once', async () => {
    const needs = { ...createEmptyNeeds(), startDate: '2026-10-12', endDate: '2026-10-15' };
    const response = await runConciergeTurn(sameAsLastTime('zh', needs), {
      ...dependencies({ mode: 'claude', respond: neverCalled }),
      ownerId: 'owner-1',
      readLastStay: async () => lastStay,
    });

    expect(response.reply).toContain('Luna');
    expect(response.reply).not.toContain('哪几天');
    expect(response.combos).toHaveLength(3);
    expect(response.lastStay?.selection).toEqual(lastStay.selection);
  });

  it('asks a guest to sign in, and tells a parent with no stay to start fresh', async () => {
    const guest = await runConciergeTurn(sameAsLastTime(), {
      ...dependencies({ mode: 'claude', respond: neverCalled }),
      ownerId: null,
    });
    expect(guest.reply).toMatch(/sign in first/);
    expect(guest.lastStay).toBeNull();

    const fresh = await runConciergeTurn(sameAsLastTime(), {
      ...dependencies({ mode: 'claude', respond: neverCalled }),
      ownerId: 'owner-2',
      readLastStay: async () => null,
    });
    expect(fresh.reply).toMatch(/start fresh/);
    expect(fresh.needs).toEqual(createEmptyNeeds());
  });
});

describe('priceConciergeSelection', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  const firstOf = (category: BookingServiceRecord['category']): string =>
    CATALOGUE.find((service) => service.category === category)?.id ?? '';

  const selection = {
    pets: [{ roomId: firstOf('boarding_rate'), foodId: firstOf('food'), addonIds: [] }],
  };

  const priceFor = (needs: ConciergeNeeds): ReturnType<typeof priceConciergeSelection> =>
    priceConciergeSelection(
      { needs, selection, locale: 'en' },
      {
        loadCatalogue: async (): Promise<BookingServiceRecord[]> => CATALOGUE,
        today: (): string => TODAY,
      },
    );

  it('signs a stay the guest built when its dates are bookable', async () => {
    const { quote } = await priceFor(readyNeeds());

    const signed = await verifyQuote(quote.quoteToken);
    expect(signed).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-15', nights: 3 });
  });

  it.each([
    ['a stay that started in the past', { startDate: '2026-09-20', endDate: '2026-09-23' }],
    ['a pick-up before the drop-off', { startDate: '2026-10-15', endDate: '2026-10-12' }],
    ['a pick-up on the drop-off day', { startDate: '2026-10-12', endDate: '2026-10-12' }],
    ['a stay longer than the facility books', { startDate: '2026-10-12', endDate: '2027-10-12' }],
  ])('refuses to sign %s', async (_case, dates) => {
    await expect(priceFor(readyNeeds(dates))).rejects.toMatchObject({
      code: 'CONCIERGE_SELECTION_INVALID',
      statusCode: 422,
    });
  });

  it('refuses to sign a stay whose pet has no species', async () => {
    const needs = readyNeeds({
      pets: [{ species: null, size: null, needsMedication: false, firstTimeBoarding: false }],
    });

    await expect(priceFor(needs)).rejects.toMatchObject({ code: 'CONCIERGE_SELECTION_INVALID' });
  });
});

describe('acceptConciergeQuote', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  it('signs an acceptance with the time of the click', async () => {
    const turn = await runConciergeTurn(
      request({ needs: readyNeeds() }),
      dependencies(new RulesConciergeAssistant()),
    );
    const chosen = turn.combos[1]?.quote;

    const accepted = await acceptConciergeQuote(chosen?.quoteToken ?? '', ACCEPTED_AT);
    const verified = await verifyAcceptedQuote(accepted.acceptedQuoteToken);

    expect(accepted.name).toBe(chosen?.name);
    expect(verified.name).toBe(chosen?.name);
    expect(verified.acceptedAt).toBe(ACCEPTED_AT.toISOString());
    expect(verified.quote.total).toBe(chosen?.total);
  });
});

describe('getConciergeRates', () => {
  it('quotes the cheapest bookable stay: one pet, one night, Essential', async () => {
    const rates = await getConciergeRates({
      loadCatalogue: async (): Promise<BookingServiceRecord[]> => CATALOGUE,
      today: (): string => TODAY,
    });

    expect(rates).toEqual({ fromTotal: 45, nights: 1, currency: 'NZD', gstInclusive: true });
  });

  it('includes compulsory services in the "from" price', async () => {
    const withCompulsory = CATALOGUE.map((service) =>
      service.category === 'addon' && service.price === 5
        ? { ...service, compulsory: true }
        : service,
    );

    const rates = await getConciergeRates({
      loadCatalogue: async (): Promise<BookingServiceRecord[]> => withCompulsory,
      today: (): string => TODAY,
    });

    expect(rates.fromTotal).toBeGreaterThan(45);
  });
});
