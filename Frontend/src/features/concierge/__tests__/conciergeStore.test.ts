import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../pet-parent/api/bookingApi';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY } from '../copy';
import {
  CHECKLIST_REFRESH_DELAY_MS,
  createEmptyNeeds,
  MISSES_BEFORE_HELP,
  PRICE_REFRESH_DELAY_MS,
  selectBookedNeeds,
  selectCombosStale,
  selectRepricing,
  useConciergeStore,
} from '../store/conciergeStore';
import type { ConciergeChatResponse, ConciergeCombo, ConciergePriceResponse } from '../types';
import {
  acceptedFor,
  catalogue,
  checkoutResponse,
  combos,
  lastStayFor,
  oneDog,
  quoteFor,
  roomierCombo,
  simpleCombo,
} from './fixtures';

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: { chat: vi.fn(), priceSelection: vi.fn(), fetchLastStay: vi.fn() },
}));

const response = (overrides: Partial<ConciergeChatResponse> = {}): ConciergeChatResponse => ({
  reply: 'Which dates are you thinking of?',
  needs: createEmptyNeeds(),
  missingFields: ['dates'],
  combos: [],
  catalogue,
  assistantMode: 'rules',
  plan: null,
  assistantAvailable: true,
  fullNights: [],
  lastStay: null,
  ...overrides,
});

/** The recommended combo again at a different price, as a later turn may return it. */
const roomierAt = (total: number): ConciergeCombo => ({
  ...roomierCombo,
  quote: { ...roomierCombo.quote, total, quoteToken: `quote-roomier-${total}` },
});

/** The plan priced, with the recommended combo applied, as the store holds it after a turn. */
const withStay = (): void => {
  useConciergeStore.setState({
    needs: oneDog,
    pricedNeeds: oneDog,
    missingFields: [],
    combos,
    catalogue,
    selection: roomierCombo.quote.selection,
    stayQuote: roomierCombo.quote,
    appliedComboId: roomierCombo.id,
    customised: false,
  });
};

/** The server's price for a hand-built stay: the deluxe suite with grooming added. */
const groomedQuote = quoteFor(
  [{ roomId: 'room-deluxe', foodId: 'food-house', addonIds: ['addon-walk', 'addon-grooming'] }],
  'quote-groomed',
);

describe('useConciergeStore', () => {
  beforeEach(() => {
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.priceSelection).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('knows the service up front, since /book is for boarding stays', () => {
    expect(useConciergeStore.getState().needs.service).toBe('boarding');
  });

  it('rewrites the greeting for the assistant that answers, in the current language', () => {
    const store = useConciergeStore.getState();
    expect(store.messages[0]?.text).toMatch(/an automated helper, not a person/);

    store.setAssistantMode('rules');
    expect(useConciergeStore.getState().messages[0]?.text).toMatch(/simple phrases only/);

    store.setAssistantMode('claude');
    expect(useConciergeStore.getState().messages[0]?.text).toMatch(/I’m an AI, not a person/);

    store.setLocale('zh');
    expect(useConciergeStore.getState().messages[0]?.text).toMatch(/是 AI，不是真人/);
  });

  it('sends the guest message without the local greeting and shows the reply', async () => {
    vi.mocked(conciergeApi.chat).mockResolvedValue(response());

    await act(async () => {
      await useConciergeStore.getState().sendMessage('  two dogs  ');
    });

    const request = vi.mocked(conciergeApi.chat).mock.calls[0]?.[0];
    expect(request?.messages).toEqual([{ role: 'user', text: 'two dogs' }]);
    expect(request?.trigger).toBe('message');
    const texts = useConciergeStore.getState().messages.map((message) => message.text);
    expect(texts.at(-1)).toBe('Which dates are you thinking of?');
  });

  it('applies a tapped answer as a structured change and shows it as the guest message', async () => {
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      response({ needs: request.needs }),
    );

    await act(async () => {
      await useConciergeStore.getState().chooseAnswer('2 dogs', (needs) => ({
        ...needs,
        pets: [
          { species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null },
          { species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null },
        ],
      }));
    });

    const request = vi.mocked(conciergeApi.chat).mock.calls[0]?.[0];
    expect(request?.trigger).toBe('choice');
    expect(request?.needs.pets).toHaveLength(2);
    expect(request?.messages.at(-1)).toEqual({ role: 'user', text: '2 dogs' });
  });

  it('batches checklist changes into one refresh and marks prices as updating meanwhile', async () => {
    vi.useFakeTimers();
    vi.mocked(conciergeApi.chat).mockResolvedValue(response({ reply: '' }));
    const { updateNeeds } = useConciergeStore.getState();

    updateNeeds((needs) => ({ ...needs, startDate: '2026-10-12' }));
    updateNeeds((needs) => ({ ...needs, endDate: '2026-10-15' }));
    expect(useConciergeStore.getState().refreshPending).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_DELAY_MS);
    });

    expect(conciergeApi.chat).toHaveBeenCalledTimes(1);
    const request = vi.mocked(conciergeApi.chat).mock.calls[0]?.[0];
    expect(request?.trigger).toBe('checklist');
    expect(request?.needs.endDate).toBe('2026-10-15');
    // A checklist refresh adds no chat message.
    expect(useConciergeStore.getState().messages).toHaveLength(1);
    expect(useConciergeStore.getState().refreshPending).toBe(false);
  });

  it('ignores an older answer that arrives after a newer one', async () => {
    let resolveFirst: (value: ConciergeChatResponse) => void = () => undefined;
    vi.mocked(conciergeApi.chat)
      .mockImplementationOnce(
        () =>
          new Promise<ConciergeChatResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(response({ reply: 'newer answer' }));

    const first = useConciergeStore.getState().sendMessage('first');
    await act(async () => {
      await useConciergeStore.getState().sendMessage('second');
    });
    await act(async () => {
      resolveFirst(response({ reply: 'older answer' }));
      await first;
    });

    const texts = useConciergeStore.getState().messages.map((message) => message.text);
    expect(texts).toContain('newer answer');
    expect(texts).not.toContain('older answer');
  });

  it('explains failures in the guest’s language and retries without retyping', async () => {
    vi.mocked(conciergeApi.chat)
      .mockRejectedValueOnce(new ApiError('Too many requests.', 429, null))
      .mockResolvedValueOnce(response({ reply: 'Back again' }));

    await act(async () => {
      await useConciergeStore.getState().sendMessage('hello');
    });
    expect(useConciergeStore.getState().turnStatus).toBe('error');
    expect(useConciergeStore.getState().turnError?.(CONCIERGE_COPY.en)).toMatch(/wait a minute/);

    await act(async () => {
      await useConciergeStore.getState().retryLastTurn();
    });
    const guestMessages = useConciergeStore
      .getState()
      .messages.filter((message) => message.role === 'user');
    expect(guestMessages).toHaveLength(1);
    expect(useConciergeStore.getState().messages.at(-1)?.text).toBe('Back again');
  });

  it('says a lost connection is a connection problem, in Chinese on the Chinese page', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(conciergeApi.chat).mockRejectedValue(new TypeError('Failed to fetch'));

    await act(async () => {
      await useConciergeStore.getState().sendMessage('你好');
    });

    const { turnError } = useConciergeStore.getState();
    expect(turnError?.(CONCIERGE_COPY.zh)).toBe(
      '预约系统暂时没有响应，请稍后再试，或联系工作人员。',
    );
    // Kept as what happened, so switching back to English rewords it.
    expect(turnError?.(CONCIERGE_COPY.en)).not.toMatch(/[一-鿿]/);
  });

  it('follows the recommended combo when a reply brings options, opens the panel and marks the reply', async () => {
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({ reply: 'Your options are ready.', needs: oneDog, missingFields: [], combos }),
    );

    await act(async () => {
      await useConciergeStore.getState().sendMessage('One large dog');
    });

    const state = useConciergeStore.getState();
    expect(state.appliedComboId).toBe(roomierCombo.id);
    expect(state.stayQuote).toEqual(roomierCombo.quote);
    expect(state.selection).toEqual(roomierCombo.quote.selection);
    expect(state.stayPanelOpen).toBe(true);
    expect(state.messages.at(-1)?.offersStay).toBe(true);
    // The combo's own signed price is used; nothing is priced again.
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('keeps the applied combo when its price changes, and says so', async () => {
    withStay();
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({
        reply: '',
        needs: oneDog,
        missingFields: [],
        combos: [simpleCombo, roomierAt(280)],
      }),
    );

    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    expect(useConciergeStore.getState().appliedComboId).toBe(roomierCombo.id);
    expect(useConciergeStore.getState().stayQuote?.total).toBe(280);
    expect(useConciergeStore.getState().priceNotice?.(CONCIERGE_COPY.en)).toBe(
      'Deluxe suite, House food and Outdoor walk is now $280.00 (it was $267.00).',
    );
  });

  it('prices a ticked add-on through /price after a short pause, keeping only the last answer', async () => {
    vi.useFakeTimers();
    withStay();
    const price: ConciergePriceResponse = { quote: groomedQuote };
    vi.mocked(conciergeApi.priceSelection).mockResolvedValue(price);

    useConciergeStore.getState().togglePetAddon(0, 'addon-grooming');
    expect(useConciergeStore.getState().customised).toBe(true);
    expect(useConciergeStore.getState().appliedComboId).toBeNull();
    expect(selectRepricing(useConciergeStore.getState())).toBe(true);
    // A second tick inside the pause joins the same request.
    useConciergeStore.getState().setPetFood(0, 'food-fresh');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRICE_REFRESH_DELAY_MS);
    });

    expect(conciergeApi.priceSelection).toHaveBeenCalledTimes(1);
    const request = vi.mocked(conciergeApi.priceSelection).mock.calls[0]?.[0];
    expect(request?.selection.pets[0]).toEqual({
      roomId: 'room-deluxe',
      foodId: 'food-fresh',
      addonIds: ['addon-walk', 'addon-grooming'],
    });
    expect(request?.needs).toEqual(oneDog);
    const state = useConciergeStore.getState();
    expect(state.stayQuote?.total).toBe(groomedQuote.total);
    expect(state.pricing).toBe('idle');
    expect(selectRepricing(state)).toBe(false);
  });

  it('takes a combo’s own price again when an edit lands back on it', () => {
    withStay();
    useConciergeStore.getState().togglePetAddon(0, 'addon-walk');
    expect(useConciergeStore.getState().appliedComboId).toBeNull();

    useConciergeStore.getState().togglePetAddon(0, 'addon-walk');

    expect(useConciergeStore.getState().appliedComboId).toBe(roomierCombo.id);
    expect(useConciergeStore.getState().stayQuote).toEqual(roomierCombo.quote);
    expect(useConciergeStore.getState().pricing).toBe('idle');
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('goes back to the last priced stay when the server refuses a combination', async () => {
    vi.useFakeTimers();
    withStay();
    vi.mocked(conciergeApi.priceSelection).mockRejectedValue(
      new ApiError('refused', 422, { error: { code: 'CONCIERGE_SELECTION_INVALID' } }),
    );

    useConciergeStore.getState().togglePetAddon(0, 'addon-grooming');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRICE_REFRESH_DELAY_MS);
    });

    const state = useConciergeStore.getState();
    expect(state.selection).toEqual(roomierCombo.quote.selection);
    expect(state.stayQuote).toEqual(roomierCombo.quote);
    expect(state.pricing).toBe('idle');
    expect(state.pricingError?.(CONCIERGE_COPY.en)).toBe(
      'That combination can’t be booked, so we kept your last priced stay.',
    );
  });

  it('carries a hand-built stay over a new turn and prices it again', async () => {
    withStay();
    useConciergeStore.setState({
      selection: groomedQuote.selection,
      stayQuote: groomedQuote,
      appliedComboId: null,
      customised: true,
    });
    const twoNights = { ...oneDog, endDate: '2026-12-14' };
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({ reply: '', needs: twoNights, missingFields: [], combos }),
    );
    vi.mocked(conciergeApi.priceSelection).mockResolvedValue({ quote: groomedQuote });

    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    expect(useConciergeStore.getState().customised).toBe(true);
    expect(conciergeApi.priceSelection).toHaveBeenCalledWith(
      expect.objectContaining({ needs: twoNights, selection: groomedQuote.selection }),
    );
  });

  it('opens the stay panel only on the plan step', () => {
    withStay();
    useConciergeStore.getState().goTo('details');
    useConciergeStore.getState().openStayPanel();
    expect(useConciergeStore.getState().stayPanelOpen).toBe(false);

    useConciergeStore.getState().goTo('plan');
    useConciergeStore.getState().openStayPanel('composer');
    expect(useConciergeStore.getState().stayPanelOpen).toBe(true);
    expect(useConciergeStore.getState().stayPanelOpener).toBe('composer');
  });

  it(`offers help after ${MISSES_BEFORE_HELP} messages that change nothing`, async () => {
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      response({ needs: request.needs }),
    );

    await act(async () => {
      await useConciergeStore.getState().sendMessage('hmm');
      await useConciergeStore.getState().sendMessage('what?');
    });

    expect(useConciergeStore.getState().missStreak).toBe(MISSES_BEFORE_HELP);
  });

  it('skips the sign-in step after Continue for a signed-in parent, and asks a guest to sign in', () => {
    withStay();
    useConciergeStore.getState().setAccepted(acceptedFor(roomierCombo.quote));
    expect(useConciergeStore.getState().step).toBe('verify');

    useConciergeStore.getState().backToOptions();
    useConciergeStore.getState().setAccepted(acceptedFor(roomierCombo.quote), { skipVerify: true });

    expect(useConciergeStore.getState().step).toBe('details');
    expect(useConciergeStore.getState().agreedQuote).toEqual(roomierCombo.quote);
    expect(useConciergeStore.getState().stayPanelOpen).toBe(false);
  });

  it('keeps the verified email and typed details when going back to the options', () => {
    useConciergeStore.getState().setVerified('ava@example.com', 'verified-token');
    useConciergeStore.getState().updateDetailsDraft((draft) => ({
      ...draft,
      contact: { ...draft.contact, firstName: 'Ava' },
    }));
    useConciergeStore.getState().backToOptions();

    const state = useConciergeStore.getState();
    expect(state.step).toBe('plan');
    expect(state.verificationToken).toBe('verified-token');
    expect(state.detailsDraft?.contact.firstName).toBe('Ava');
  });

  it('turns saved pets into the plan’s pets and links them for checkout', () => {
    vi.useFakeTimers();
    vi.mocked(conciergeApi.chat).mockResolvedValue(response({ reply: '' }));

    useConciergeStore.getState().applySavedPets([
      {
        id: 'pet-max',
        name: 'Max',
        species: 'dog',
        firstTimeBoarding: null,
        needsMedication: null,
      },
      {
        id: 'pet-luna',
        name: 'Luna',
        species: 'cat',
        firstTimeBoarding: null,
        needsMedication: null,
      },
    ]);

    const state = useConciergeStore.getState();
    expect(state.needs.pets.map((pet) => [pet.name, pet.species])).toEqual([
      ['Max', 'dog'],
      ['Luna', 'cat'],
    ]);
    expect(state.savedPetLinks).toEqual(['pet-max', 'pet-luna']);
    useConciergeStore.getState().initDetailsDraft();
    expect(useConciergeStore.getState().detailsDraft?.pets.map((pet) => pet.existingPetId)).toEqual(
      ['pet-max', 'pet-luna'],
    );
  });

  it('carries what the guest told the assistant into the care notes staff will see', () => {
    useConciergeStore.setState({
      needs: {
        ...createEmptyNeeds(),
        notes: 'Scared of thunder',
        pets: [{ species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null }],
      },
    });

    useConciergeStore.getState().initDetailsDraft();

    expect(useConciergeStore.getState().detailsDraft?.careNotes).toBe('Scared of thunder');
  });

  it('keeps the plan in this tab, never the guest’s contact details', () => {
    useConciergeStore.setState({
      needs: { ...createEmptyNeeds(), startDate: '2026-10-12', endDate: '2026-10-15' },
    });
    useConciergeStore.getState().updateDetailsDraft((draft) => ({
      ...draft,
      contact: { ...draft.contact, phone: '021 555 0199', address: '12 Queen Street' },
    }));

    const saved = window.sessionStorage.getItem('trinity-concierge-v1') ?? '';
    expect(saved).toContain('2026-10-12');
    expect(saved).not.toContain('021 555 0199');
    expect(saved).not.toContain('Queen Street');
    expect(saved).not.toContain('Ava Mitchell');
  });

  it('forgets the plan on Start over', () => {
    useConciergeStore.setState({
      needs: { ...createEmptyNeeds(), startDate: '2026-10-12', endDate: '2026-10-15' },
    });

    useConciergeStore.getState().startOver();

    expect(window.sessionStorage.getItem('trinity-concierge-v1')).toBeNull();
    expect(useConciergeStore.getState().needs.startDate).toBeNull();
  });
});

describe('useConciergeStore with "same as last time"', () => {
  const copied = lastStayFor();
  /** The plan as the server returns it on the copying turn: Max in, dates still to come. */
  const maxOnly = { ...createEmptyNeeds(), pets: copied.needs.pets };
  const maxDated = { ...maxOnly, startDate: '2026-12-12', endDate: '2026-12-15' };

  const withCopiedStay = (selection = copied.selection): void =>
    useConciergeStore.setState({
      needs: maxOnly,
      missingFields: ['dates'],
      pendingSelection: selection,
      savedPetLinks: ['pet-max'],
      savedPets: { 'pet-max': { name: 'Max', species: 'dog' } },
    });

  beforeEach(() => {
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.priceSelection).mockReset();
  });

  it('keeps the copied services for the dates and books the pet as its saved profile', async () => {
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({
        reply: 'Welcome back! Which dates?',
        needs: maxOnly,
        missingFields: ['dates'],
        lastStay: copied,
      }),
    );

    await act(async () => {
      await useConciergeStore.getState().sendMessage('same as last time');
    });

    const state = useConciergeStore.getState();
    expect(state.pendingSelection).toEqual(copied.selection);
    expect(state.savedPetLinks).toEqual(['pet-max']);
    expect(state.savedPets).toEqual({ 'pet-max': { name: 'Max', species: 'dog' } });
    // Nothing to show yet: the stay is priced once the dates are known.
    expect(state.selection).toBeNull();
    expect(state.stayPanelOpen).toBe(false);
  });

  it('takes the matching combo’s own price once the combos arrive, and opens the stay', async () => {
    withCopiedStay();
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({ reply: '', needs: maxDated, missingFields: [], combos }),
    );

    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    const state = useConciergeStore.getState();
    expect(state.appliedComboId).toBe(roomierCombo.id);
    expect(state.stayQuote).toEqual(roomierCombo.quote);
    expect(state.pendingSelection).toBeNull();
    expect(state.stayPanelOpen).toBe(true);
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('prices a copied stay that matches no combo, and keeps it as the parent’s own', async () => {
    withCopiedStay(groomedQuote.selection);
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({ reply: '', needs: maxDated, missingFields: [], combos }),
    );
    vi.mocked(conciergeApi.priceSelection).mockResolvedValue({ quote: groomedQuote });

    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    expect(conciergeApi.priceSelection).toHaveBeenCalledWith(
      expect.objectContaining({ needs: maxDated, selection: groomedQuote.selection }),
    );
    const state = useConciergeStore.getState();
    expect(state.customised).toBe(true);
    expect(state.appliedComboId).toBeNull();
    expect(state.stayQuote?.total).toBe(groomedQuote.total);
    expect(state.pendingSelection).toBeNull();
    expect(state.stayPanelOpen).toBe(true);
  });

  it('drops the copy when the pets no longer match it, and follows the recommendation', async () => {
    const twoPets = lastStayFor([...copied.selection.pets, ...copied.selection.pets]);
    withCopiedStay(twoPets.selection);
    vi.mocked(conciergeApi.chat).mockResolvedValue(
      response({ reply: '', needs: maxDated, missingFields: [], combos }),
    );

    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    const state = useConciergeStore.getState();
    expect(state.pendingSelection).toBeNull();
    expect(state.appliedComboId).toBe(roomierCombo.id);
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('forgets the copy on Start over', () => {
    withCopiedStay();

    useConciergeStore.getState().startOver();

    expect(useConciergeStore.getState().pendingSelection).toBeNull();
  });
});

describe('useConciergeStore review regressions', () => {
  const plan = {
    ...createEmptyNeeds(),
    startDate: '2026-12-07',
    endDate: '2026-12-10',
    pets: [
      {
        species: 'dog' as const,
        size: 'large' as const,
        needsMedication: false,
        firstTimeBoarding: null,
      },
    ],
  };

  beforeEach(() => {
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.priceSelection).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('never lets old prices be agreed to after a change whose re-price failed', async () => {
    useConciergeStore.setState({
      needs: plan,
      pricedNeeds: plan,
      combos,
      catalogue,
      stayQuote: roomierCombo.quote,
      selection: roomierCombo.quote.selection,
      appliedComboId: roomierCombo.id,
      missingFields: [],
    });
    vi.mocked(conciergeApi.chat).mockRejectedValue(new TypeError('Failed to fetch'));

    useConciergeStore.getState().updateNeeds((needs) => ({ ...needs, endDate: '2026-12-12' }));
    await act(async () => {
      await useConciergeStore.getState().refreshQuotes();
    });

    const state = useConciergeStore.getState();
    expect(state.turnStatus).toBe('error');
    expect(selectCombosStale(state)).toBe(true);
    expect(selectRepricing(state)).toBe(true);
  });

  it('keeps a tick made while a re-price was on its way, and prices it next', async () => {
    vi.useFakeTimers();
    useConciergeStore.setState({ needs: plan, pricedNeeds: plan, missingFields: [] });
    let resolveFirst: (value: ConciergeChatResponse) => void = () => undefined;
    vi.mocked(conciergeApi.chat)
      .mockImplementationOnce(
        () =>
          new Promise<ConciergeChatResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementation(async (request) => response({ needs: request.needs, missingFields: [] }));

    const first = useConciergeStore.getState().refreshQuotes();
    useConciergeStore.getState().updateNeeds((needs) => ({
      ...needs,
      extras: { ...needs.extras, walks: true },
    }));
    await act(async () => {
      resolveFirst(response({ needs: plan, missingFields: [] }));
      await first;
    });
    expect(useConciergeStore.getState().needs.extras.walks).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_DELAY_MS);
    });
    const last = vi.mocked(conciergeApi.chat).mock.calls.at(-1)?.[0];
    expect(last?.needs.extras.walks).toBe(true);
  });

  it('drops a saved-pet link as soon as that position holds a different kind of pet', () => {
    vi.useFakeTimers();
    vi.mocked(conciergeApi.chat).mockResolvedValue(response({ reply: '' }));
    useConciergeStore.getState().applySavedPets([
      {
        id: 'pet-rex',
        name: 'Rex',
        species: 'dog',
        firstTimeBoarding: null,
        needsMedication: null,
      },
    ]);
    expect(useConciergeStore.getState().savedPetLinks).toEqual(['pet-rex']);

    useConciergeStore.getState().updateNeeds((needs) => ({
      ...needs,
      pets: needs.pets.map((pet) => ({ ...pet, species: 'cat' as const })),
    }));

    expect(useConciergeStore.getState().savedPetLinks).toEqual([null]);
  });

  it('shows the agreed dates on the details step even if the plan is edited afterwards', () => {
    useConciergeStore.setState({ needs: plan, pricedNeeds: plan, missingFields: [] });
    useConciergeStore.getState().setAccepted(acceptedFor(roomierCombo.quote));
    useConciergeStore.setState({ needs: { ...plan, endDate: '2026-12-20' } });

    expect(selectBookedNeeds(useConciergeStore.getState()).endDate).toBe('2026-12-10');
  });

  it('keeps only the confirmation after sending: no chat, notes, names or email in the tab', () => {
    useConciergeStore.setState({
      needs: {
        ...plan,
        notes: 'Scared of thunder',
        pets: plan.pets.map((pet) => ({ ...pet, name: 'Biscuit' })),
      },
      pricedNeeds: plan,
      verifiedEmail: 'ava@example.com',
      messages: [
        ...useConciergeStore.getState().messages,
        { id: 'm1', role: 'user', text: 'my number is 021 555 0199' },
      ],
    });
    useConciergeStore
      .getState()
      .setCheckoutResult(checkoutResponse({ bookingId: 'b1', bookingPetIds: [], safetyTasks: [] }));

    const saved = window.sessionStorage.getItem('trinity-concierge-v1') ?? '';
    expect(saved).toContain('PB-AAAAAA');
    expect(saved).toContain('2026-12-07');
    expect(saved).not.toContain('021 555 0199');
    expect(saved).not.toContain('Scared of thunder');
    expect(saved).not.toContain('Biscuit');
    expect(saved).not.toContain('ava@example.com');
  });

  it('keeps the lines of the booked stay after sending, for the receipt', () => {
    useConciergeStore.setState({
      needs: plan,
      agreedNeeds: plan,
      pricedNeeds: plan,
      accepted: acceptedFor(roomierCombo.quote),
      agreedQuote: roomierCombo.quote,
      combos,
      stayQuote: roomierCombo.quote,
      selection: roomierCombo.quote.selection,
    });
    useConciergeStore
      .getState()
      .setCheckoutResult(checkoutResponse({ bookingPetIds: ['bp1'], pets: [], safetyTasks: [] }));

    const state = useConciergeStore.getState();
    expect(state.needs).toEqual({
      ...createEmptyNeeds(),
      startDate: '2026-12-07',
      endDate: '2026-12-10',
    });
    expect(state.booked).toEqual({ lines: roomierCombo.quote.lines });
    expect(state.combos).toEqual([]);
    expect(state.stayQuote).toBeNull();
    const saved = JSON.parse(window.sessionStorage.getItem('trinity-concierge-v1') ?? '{}') as {
      needs?: { pets?: unknown };
      booked?: { lines?: unknown[] };
      combos?: unknown[];
    };
    expect(saved.booked?.lines).toHaveLength(roomierCombo.quote.lines.length);
    expect(saved.combos).toEqual([]);
    expect(saved.needs?.pets).toEqual([]);
  });
});
