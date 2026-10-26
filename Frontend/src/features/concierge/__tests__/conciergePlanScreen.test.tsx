import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { useConciergeStore } from '../store/conciergeStore';
import { formatDateRange } from '../utils/format';
import {
  chatAnswer,
  dropOff,
  oneDog,
  pickUp,
  renderPage,
  resetPage,
  withStay,
} from './conciergePageFixtures';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';

/**
 * Where each part of the plan lives: one stay card with a status line beside the chat, the stay
 * panel reached from the chat, and no boarding pass until the request is sent.
 */

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

const stayCard = (name: string | RegExp = 'Your stay'): HTMLElement =>
  screen.getByRole('region', { name });

describe('the plan screen', () => {
  beforeEach(() => {
    resetPage();
    vi.mocked(conciergeApi.chat).mockReset();
    // A plan that is ready but has no options yet is priced on arrival; answer that quietly.
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      chatAnswer({ needs: request.needs }),
    );
  });

  it('has one stay card and no boarding pass before the request is sent', () => {
    renderPage();

    expect(stayCard()).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Boarding pass' })).not.toBeInTheDocument();
    expect(screen.queryByText('Boarding pass')).not.toBeInTheDocument();
  });

  it('reads the chat, then the stay card, as a phone shows them', () => {
    withStay();
    renderPage();

    const chat = screen.getByRole('region', { name: 'Booking assistant' });
    const follows = (earlier: HTMLElement, later: HTMLElement): boolean =>
      Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(chat, stayCard())).toBe(true);
  });

  it('says in the stay card what is still needed', () => {
    renderPage();

    expect(within(stayCard()).getByRole('status')).toHaveTextContent(
      'Still needed: dates, number of pets',
    );
  });

  it('explains a date problem in its own words instead of a bare "dates"', () => {
    useConciergeStore.setState({
      needs: { ...oneDog, endDate: dropOff },
      missingFields: ['dates'],
    });
    renderPage();

    const status = within(stayCard()).getByRole('status');
    expect(status).toHaveTextContent('Check-out must be at least one day after check-in.');
    expect(status).not.toHaveTextContent('Still needed');
  });

  it('says the stay is ready to quote once nothing is missing', () => {
    useConciergeStore.setState({ needs: oneDog, missingFields: [] });
    renderPage();

    expect(within(stayCard()).getByRole('status')).toHaveTextContent('Ready to quote');
  });

  it('sums up the stay in one line while the card is folded, and drops it when opened', async () => {
    const user = userEvent.setup();
    useConciergeStore.setState({ needs: oneDog, missingFields: [] });
    renderPage();

    const glance = `${formatDateRange(dropOff, pickUp, 'en')} · 3 nights · 1 pet`;
    expect(within(stayCard()).getByText(glance)).toBeInTheDocument();

    await user.click(within(stayCard()).getByRole('button', { name: 'Edit your stay' }));

    expect(within(stayCard()).queryByText(glance)).not.toBeInTheDocument();
  });

  it('keeps the add-on ticks in the stay panel, not in the stay card', () => {
    withStay();
    renderPage();

    expect(within(stayCard()).queryByRole('checkbox', { name: /walk/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^Your stay/ })).toBeInTheDocument();
  });

  it('names the stay card and the way to the stay in Chinese', async () => {
    withStay();
    renderPage();

    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(
      within(stayCard('你的住宿')).getByText(
        `${formatDateRange(dropOff, pickUp, 'zh')} · 3 晚 · 1 只宠物`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^我的住宿/ })).toBeInTheDocument();
    expect(englishWordsIn(document.body)).toEqual([]);
  });
});
