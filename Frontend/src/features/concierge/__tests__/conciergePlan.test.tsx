import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergePlan } from '../types';
import { buildQuickReplies } from '../utils/quickReplies';
import { resetConciergeStatusCache } from '../hooks/useConciergeStatus';
import {
  acceptedFor,
  chatAnswer,
  combos,
  oneDog,
  renderPage,
  resetPage,
  roomierCombo,
  withStay,
} from './conciergePageFixtures';
import { statusResponse } from './fixtures';

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    priceSelection: vi.fn(),
    acceptQuote: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
  },
}));

const BOOK_FOR_ME = 'Book the recommended stay for me';

const plan = (overrides: Partial<ConciergePlan> = {}): ConciergePlan => ({
  recommendedComboId: roomierCombo.id,
  reason: 'A roomier suite suits a large dog.',
  bookRequested: false,
  prefill: null,
  ...overrides,
});

describe('the assistant’s plan', () => {
  beforeEach(() => {
    resetPage();
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.acceptQuote).mockReset();
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      chatAnswer({ needs: request.needs, combos, assistantMode: 'openai' }),
    );
  });

  it('offers "book it for me" only once a recommendation is on screen', () => {
    const input = {
      copy: CONCIERGE_COPY.en,
      needs: oneDog,
      missingFields: [],
      comboCount: 3,
      isFirstTurn: false,
      today: '2026-10-06',
    };
    const labels = (replies: ReturnType<typeof buildQuickReplies>): string[] =>
      replies?.replies.map((reply) => reply.label) ?? [];
    expect(labels(buildQuickReplies(input))).not.toContain(BOOK_FOR_ME);
    const withPlan = buildQuickReplies({ ...input, plan: plan() });
    expect(labels(withPlan)).toContain(BOOK_FOR_ME);
    const chip = withPlan?.replies.find((reply) => reply.kind === 'say');
    expect(chip?.kind === 'say' && chip.message).toBe(BOOK_FOR_ME);
    expect(
      labels(buildQuickReplies({ ...input, plan: plan({ bookRequested: true }) })),
    ).not.toContain(BOOK_FOR_ME);
  });

  it('marks the recommended combo in the panel and shows its reason', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();
    act(() => useConciergeStore.setState({ plan: plan() }));

    await user.click(screen.getByRole('button', { name: /^Your stay/ }));

    const panel = screen.getByRole('dialog', { name: 'Your stay' });
    const recommended = within(panel).getByText('Recommended for you').closest('li');
    expect(recommended).toHaveTextContent(roomierCombo.reason);
    expect(recommended).toHaveTextContent('In use');
  });

  it('keeps the plan the server sends with the options, and opens the stay', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.chat).mockResolvedValueOnce(
      chatAnswer({
        reply: 'Your options are ready.',
        combos,
        plan: plan(),
        assistantMode: 'openai',
      }),
    );
    renderPage();

    await user.type(screen.getByRole('textbox', { name: /Booking assistant/ }), 'One large dog');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(useConciergeStore.getState().plan).toEqual(plan()));
    expect(useConciergeStore.getState().assistantMode).toBe('openai');
    expect(useConciergeStore.getState().stayPanelOpen).toBe(true);
    expect(screen.getByRole('button', { name: BOOK_FOR_ME })).toBeInTheDocument();
  });

  it('hands off "book it": applies the recommended stay, agrees to its price and prefills the form', async () => {
    withStay();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    renderPage();

    act(() =>
      useConciergeStore.setState({
        plan: plan({
          bookRequested: true,
          prefill: { firstName: 'Hana', phone: '021 555 0142', dropOffTime: '09:00' },
        }),
      }),
    );

    await waitFor(() =>
      expect(conciergeApi.acceptQuote).toHaveBeenCalledWith(roomierCombo.quote.quoteToken),
    );
    await waitFor(() => expect(useConciergeStore.getState().step).not.toBe('plan'));
    expect(useConciergeStore.getState().appliedComboId).toBe(roomierCombo.id);

    act(() => useConciergeStore.getState().initDetailsDraft());
    const draft = useConciergeStore.getState().detailsDraft;
    expect(draft?.contact.firstName).toBe('Hana');
    expect(draft?.contact.phone).toBe('021 555 0142');
    expect(draft?.dropOffTime).toBe('09:00');
    // The agreement boxes are never ticked for the guest.
    expect(draft?.termsAccepted).toBe(false);
    expect(draft?.vetConsent).toBe(false);
  });

  it('applies the recommended stay and opens the panel, but accepts nothing, when online booking is off', async () => {
    resetConciergeStatusCache();
    vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse({ capacityConfigured: false }));
    withStay();
    renderPage();
    await screen.findByText(/send your plan to our team/i);

    act(() => useConciergeStore.setState({ plan: plan({ bookRequested: true }) }));

    await waitFor(() => expect(useConciergeStore.getState().stayPanelOpen).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(conciergeApi.acceptQuote).not.toHaveBeenCalled();
    expect(useConciergeStore.getState().step).toBe('plan');
  });

  it('does not run the hand-off again after the guest steps back to the options', async () => {
    withStay();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    renderPage();
    act(() => useConciergeStore.setState({ plan: plan({ bookRequested: true }) }));
    await waitFor(() => expect(conciergeApi.acceptQuote).toHaveBeenCalledTimes(1));

    act(() => useConciergeStore.getState().backToOptions());
    expect(useConciergeStore.getState().plan?.bookRequested).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(conciergeApi.acceptQuote).toHaveBeenCalledTimes(1);
  });
});
