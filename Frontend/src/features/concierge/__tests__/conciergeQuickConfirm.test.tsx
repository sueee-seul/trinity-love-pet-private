import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY } from '../copy';
import { QUICK_CONFIRM_COPY } from '../quickConfirmCopy';
import { useConciergeStore } from '../store/conciergeStore';
import { useQuickConfirmStore } from '../store/quickConfirm';
import type { ConciergeNeeds, ConciergePlan } from '../types';
import { isConfirmReply } from '../utils/quickConfirmReply';
import {
  acceptedFor,
  chatAnswer,
  oneDog,
  renderPage,
  resetPage,
  roomierCombo,
  withStay,
} from './conciergePageFixtures';
import { checkoutResponse, signInParent } from './fixtures';

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    priceSelection: vi.fn(),
    acceptQuote: vi.fn(),
    cardSetup: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
    lastStay: vi.fn(),
  },
}));

const namedDog: ConciergeNeeds = {
  ...oneDog,
  pets: oneDog.pets.map((pet) => ({ ...pet, name: 'Biscuit' })),
};

const bookItPlan = (): ConciergePlan => ({
  recommendedComboId: roomierCombo.id,
  reason: 'A roomier suite suits a large dog.',
  bookRequested: true,
  prefill: { dropOffTime: '10:00', pickUpTime: '16:00' },
});

/** Ava asks the assistant to book, with everything the booking needs already said in the chat. */
const askToBook = (needs: ConciergeNeeds = namedDog): void => {
  signInParent();
  withStay();
  useConciergeStore.setState({ needs, pricedNeeds: needs });
  renderPage();
  act(() => useConciergeStore.setState({ plan: bookItPlan() }));
};

describe('one-step booking after "book it for me"', () => {
  beforeEach(() => {
    resetPage();
    useQuickConfirmStore.setState({ plan: null, chatConfirmations: 0 });
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.checkout).mockReset();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    vi.mocked(conciergeApi.checkout).mockResolvedValue(checkoutResponse());
    vi.mocked(conciergeApi.chat).mockResolvedValue(chatAnswer());
  });

  it('shows one booking card beside the chat and books with both agreements on one press', async () => {
    const user = userEvent.setup();
    askToBook();

    expect(
      await screen.findByRole('heading', { name: 'Confirm your booking' }),
    ).toBeInTheDocument();
    // The parent stays on the chat screen; nothing was sent yet.
    expect(useConciergeStore.getState().step).toBe('plan');
    expect(conciergeApi.checkout).not.toHaveBeenCalled();
    expect(
      screen.getByText(/By confirming this booking you agree to the booking terms/),
    ).toBeInTheDocument();
    // The card has no boxes, so the terms never point the parent to one.
    expect(screen.queryByText(/its own tick/)).not.toBeInTheDocument();
    expect(screen.getByText(/given by confirming this booking/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(conciergeApi.checkout).toHaveBeenCalledTimes(1));
    const request = vi.mocked(conciergeApi.checkout).mock.calls[0]?.[0];
    expect(request).toMatchObject({
      agreement: { termsAccepted: true, vetConsentAccepted: true },
    });
    await waitFor(() => expect(useConciergeStore.getState().step).toBe('done'));
  });

  it('books on a typed "confirm" without asking the assistant again', async () => {
    const user = userEvent.setup();
    askToBook();
    await screen.findByRole('heading', { name: 'Confirm your booking' });

    await user.type(screen.getByRole('textbox', { name: /Booking assistant/ }), '确认');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(conciergeApi.checkout).toHaveBeenCalledTimes(1));
    expect(conciergeApi.chat).not.toHaveBeenCalled();
  });

  it('sends the parent to the full form when the chat left a detail out', async () => {
    const user = userEvent.setup();
    // The pet has no name yet, so one press cannot send the booking.
    askToBook(oneDog);

    await user.click(await screen.findByRole('button', { name: 'Fill in the details' }));

    expect(useConciergeStore.getState().step).toBe('details');
    expect(screen.queryByRole('heading', { name: 'Confirm your booking' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send booking request' })).toBeInTheDocument();
    expect(conciergeApi.checkout).not.toHaveBeenCalled();
  });

  it('closes the card when the parent goes back to the options', async () => {
    askToBook();
    await screen.findByRole('heading', { name: 'Confirm your booking' });

    act(() => useConciergeStore.getState().backToOptions());

    expect(screen.queryByRole('heading', { name: 'Confirm your booking' })).not.toBeInTheDocument();
  });
});

describe('isConfirmReply', () => {
  it('takes a short, plain confirmation in either language', () => {
    for (const reply of [
      'confirm',
      'Confirm.',
      'Yes, confirm',
      'confirm booking',
      '确认',
      '确认预订',
      '好，确认',
    ]) {
      expect(isConfirmReply(reply)).toBe(true);
    }
  });

  it('leaves any other message to the assistant', () => {
    for (const reply of [
      'yes',
      'can you confirm the dates?',
      'confirm the 3rd to the 5th',
      '确认一下价格',
    ]) {
      expect(isConfirmReply(reply)).toBe(false);
    }
  });
});

describe('the quick card terms', () => {
  it('finds the form’s vet consent tick in the terms of both languages, so the card can reword it', () => {
    for (const locale of ['en', 'zh'] as const) {
      const words = QUICK_CONFIRM_COPY[locale];
      expect(
        CONCIERGE_COPY[locale].details.termsSummary.some((term) => term.includes(words.tickClause)),
      ).toBe(true);
    }
  });
});
