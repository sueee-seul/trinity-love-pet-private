import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { conciergeApi } from '../api/conciergeApi';
import { ConciergePage } from '../components/ConciergePage';
import { resetConciergeStatusCache } from '../hooks/useConciergeStatus';
import { createEmptyNeeds, useConciergeStore } from '../store/conciergeStore';
import type {
  ConciergeChatResponse,
  ConciergeCheckoutResponse,
  ConciergeCombo,
  ConciergeNeeds,
} from '../types';
import { addDays, todayInNewZealand } from '../utils/format';
import { catalogue, combos, fakeCardSetup, roomierCombo, statusResponse } from './fixtures';

export { acceptedFor, catalogue, combos, quoteFor, roomierCombo, simpleCombo } from './fixtures';

/**
 * Shared plan, catalogue, combos and hand-over for the page tests. Each test file mocks
 * conciergeApi itself (vi.mock is hoisted per file), and these helpers set that mock's answers.
 */

export const dropOff = addDays(todayInNewZealand(), 20);
export const pickUp = addDays(dropOff, 3);

export const oneDog: ConciergeNeeds = {
  ...createEmptyNeeds(),
  startDate: dropOff,
  endDate: pickUp,
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: null }],
};

/** A chat answer with the catalogue and no options, for a plan that is not ready yet. */
export const chatAnswer = (
  overrides: Partial<ConciergeChatResponse> = {},
): ConciergeChatResponse => ({
  reply: '',
  needs: oneDog,
  missingFields: [],
  combos: [],
  catalogue,
  assistantMode: 'rules',
  plan: null,
  assistantAvailable: true,
  fullNights: [],
  lastStay: null,
  ...overrides,
});

/** The plan priced, with the recommended combo applied, as the store holds it after a turn. */
export const withStay = (applied: ConciergeCombo = roomierCombo): void => {
  useConciergeStore.setState({
    needs: oneDog,
    pricedNeeds: oneDog,
    missingFields: [],
    combos,
    catalogue,
    selection: applied.quote.selection,
    stayQuote: applied.quote,
    appliedComboId: applied.id,
    customised: false,
  });
};

export const sent: ConciergeCheckoutResponse = {
  bookingId: 'booking-1',
  bookingPetIds: ['booking-pet-1', 'booking-pet-2'],
  confirmationNumber: 'PB-AAAAAA',
  status: 'awaiting_manager_approval',
  pets: [
    { name: 'Biscuit', status: 'waiting_for_review', reviewReasons: ['medication'] },
    { name: 'Mochi', status: 'waiting_for_review', reviewReasons: ['medication'] },
  ],
  total: 230,
  currency: 'NZD',
  accountCreated: false,
  safetyTasks: ['vaccination_certificate'],
  // The stay waits for our manager: its $230 is held until the review deadline.
  payment: { status: 'held', amount: 230, reviewBy: '2026-12-02T02:00:00.000Z', testMode: true },
};

/**
 * A clean plan in English for a guest (the app shell's session check done), the "from" price
 * known and the card fake on. A test that needs a parent signs one in after this.
 */
export const resetPage = (): void => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: false });
  useConciergeStore.getState().reset();
  useConciergeStore.getState().setLocale('en');
  resetConciergeStatusCache();
  vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse());
  // A signed-in parent's pets and last stay are asked for on arrival; by default there are none.
  vi.mocked(conciergeApi.myPets).mockResolvedValue([]);
  // The details step saves a card: the development fake confirms it without a card form.
  vi.mocked(conciergeApi.cardSetup).mockResolvedValue(fakeCardSetup());
  vi.mocked(conciergeApi.rates).mockResolvedValue({
    fromTotal: 45,
    nights: 1,
    currency: 'NZD',
    gstInclusive: true,
  });
};

export const renderPage = (variant: 'standalone' | 'portal' = 'standalone'): void => {
  render(
    <MemoryRouter initialEntries={[variant === 'portal' ? '/parent/booking' : '/book']}>
      <ConciergePage variant={variant} />
    </MemoryRouter>,
  );
};
