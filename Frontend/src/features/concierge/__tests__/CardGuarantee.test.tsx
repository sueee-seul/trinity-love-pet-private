import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { ApiError } from '../../pet-parent/api/bookingApi';
import { conciergeApi } from '../api/conciergeApi';
import { ConciergePage } from '../components/ConciergePage';
import { resetConciergeStatusCache } from '../hooks/useConciergeStatus';
import { useConciergeStore } from '../store/conciergeStore';
import {
  AVA,
  checkoutResponse,
  fakeCardSetup,
  openFilledDetails,
  statusResponse,
} from './fixtures';

vi.mock('../../../shared/auth/api/authApi', () => ({
  authApi: { checkEmail: vi.fn(), loginWithPassword: vi.fn(), logout: vi.fn() },
}));

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    acceptQuote: vi.fn(),
    cardSetup: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
  },
}));

vi.mock('../hooks/useSignedInPetOwner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSignedInPetOwner')>()),
  refreshSession: vi.fn(async () => undefined),
}));

const TEST_MODE_NOTE = 'Test mode: no card is needed and nothing is charged.';

const renderDetails = (): void => {
  openFilledDetails();
  render(
    <MemoryRouter initialEntries={['/book']}>
      <ConciergePage variant="standalone" />
    </MemoryRouter>,
  );
};

const refusal = (code: string, status: number): ApiError =>
  new ApiError(code, status, { error: { code } });

describe('the card that guarantees a concierge request', () => {
  beforeEach(() => {
    // The app shell has finished its session check; openFilledDetails signs Ava in.
    useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: false });
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    resetConciergeStatusCache();
    vi.mocked(conciergeApi.checkout).mockReset();
    vi.mocked(conciergeApi.cardSetup).mockReset();
    vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse());
    vi.mocked(conciergeApi.myPets).mockResolvedValue([]);
    vi.mocked(conciergeApi.rates).mockResolvedValue({
      fromTotal: 45,
      nights: 1,
      currency: 'NZD',
      gstInclusive: true,
    });
  });

  it('asks for the card again when its setup no longer matches, then sends with the new card', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.cardSetup)
      .mockResolvedValueOnce(fakeCardSetup('fake_seti_first'))
      .mockResolvedValueOnce(fakeCardSetup('fake_seti_second'));
    vi.mocked(conciergeApi.checkout)
      .mockRejectedValueOnce(refusal('CONCIERGE_CARD_MISMATCH', 409))
      .mockResolvedValueOnce(checkoutResponse());
    renderDetails();

    await screen.findByText(TEST_MODE_NOTE);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    expect(screen.getByText('Please enter your card again.')).toBeInTheDocument();
    // The refused card's setup is not reused: the form asks for a new one.
    await waitFor(() => expect(conciergeApi.cardSetup).toHaveBeenCalledTimes(2));
    await screen.findByText(TEST_MODE_NOTE);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    const setupIds = vi
      .mocked(conciergeApi.checkout)
      .mock.calls.map(([request]) => request.cardSetupId);
    expect(setupIds).toEqual(['fake_seti_first', 'fake_seti_second']);
    expect(await screen.findByRole('heading', { name: 'Request sent' })).toBeInTheDocument();
    // The price is held while our manager checks; the page says until when.
    expect(
      screen.getByText(/held \$230\.00 on your card\. Our manager decides by/),
    ).toBeInTheDocument();
  });

  it('says plainly when card payments are not set up, and never sends without a card', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.cardSetup).mockRejectedValue(
      refusal('CONCIERGE_PAYMENTS_NOT_CONFIGURED', 503),
    );
    renderDetails();

    const notice =
      'Card payments aren’t set up yet, so requests can’t be sent online. Please contact our team.';
    expect(await screen.findByText(notice)).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    expect(conciergeApi.checkout).not.toHaveBeenCalled();
    // Once in the card section, and again as the reason the button did nothing.
    expect(screen.getAllByText(notice)).toHaveLength(2);
    expect(screen.queryByText(TEST_MODE_NOTE)).not.toBeInTheDocument();
  });

  it('asks the parent to sign in again, in place, when the session lapsed, then sends with the same card', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.cardSetup).mockResolvedValue(fakeCardSetup());
    vi.mocked(authApi.checkEmail).mockResolvedValue({ ok: true, status: 200, data: {} });
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: { user: { id: 'owner-1', ...AVA } } },
    });
    vi.mocked(conciergeApi.checkout)
      .mockRejectedValueOnce(refusal('CONCIERGE_EMAIL_UNVERIFIED', 401))
      .mockResolvedValueOnce(checkoutResponse());
    renderDetails();

    await screen.findByText(TEST_MODE_NOTE);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });
    expect(screen.getByText(/Your sign-in has expired/)).toBeInTheDocument();
    // The card stays on screen: it was saved for this agreement, not for the session.
    expect(screen.getByText(TEST_MODE_NOTE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign in again' }));
    const dialog = screen.getByRole('dialog', { name: 'Booked with us before? Sign in' });
    await user.type(within(dialog).getByLabelText('Email address'), AVA.email);
    await user.type(within(dialog).getByLabelText('Password'), 'Password#1');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    });
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[1] as HTMLElement);
    // Everything typed is still there, so Send is all that is left.
    expect(screen.getByLabelText('Name')).toHaveValue('Biscuit');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    expect(await screen.findByRole('heading', { name: 'Request sent' })).toBeInTheDocument();
    const second = vi.mocked(conciergeApi.checkout).mock.calls[1]?.[0];
    expect(second?.cardSetupId).toBe('fake_seti_acceptance-1');
    expect(conciergeApi.cardSetup).toHaveBeenCalledTimes(1);
  });

  it('offers to load the card form again when it fails for another reason', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.cardSetup)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(fakeCardSetup());
    renderDetails();

    expect(await screen.findByText(/The card form didn’t load\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(TEST_MODE_NOTE)).toBeInTheDocument();
    expect(conciergeApi.cardSetup).toHaveBeenCalledTimes(2);
  });
});
