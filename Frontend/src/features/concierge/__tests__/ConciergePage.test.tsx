import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { ApiError } from '../../pet-parent/api/bookingApi';
import {
  chooseDate,
  chooseTime,
  getCalendarDayButton,
} from '../../../shared/components/ui/date/testing';
import { conciergeApi } from '../api/conciergeApi';
import { ConciergePage } from '../components/ConciergePage';
import { resetConciergeStatusCache } from '../hooks/useConciergeStatus';
import { useConciergeStore } from '../store/conciergeStore';
import { addDays, todayInNewZealand } from '../utils/format';
import {
  acceptedFor,
  AVA,
  catalogue,
  checkoutResponse,
  combos,
  fakeCardSetup,
  oneDog,
  openFilledDetails,
  roomierCombo,
  signInParent,
  statusResponse,
} from './fixtures';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';

vi.mock('../../../shared/auth/api/authApi', () => ({
  authApi: { checkEmail: vi.fn(), loginWithPassword: vi.fn(), logout: vi.fn() },
}));

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
  },
}));

vi.mock('../hooks/useSignedInPetOwner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSignedInPetOwner')>()),
  refreshSession: vi.fn(async () => undefined),
}));

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
  });
};

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/book']}>
      <ConciergePage variant="standalone" />
    </MemoryRouter>,
  );
};

describe('ConciergePage', () => {
  beforeEach(() => {
    // The app shell has finished its session check: this visitor is a guest unless a test signs in.
    useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: false });
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    resetConciergeStatusCache();
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.acceptQuote).mockReset();
    vi.mocked(conciergeApi.checkout).mockReset();
    vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse());
    vi.mocked(conciergeApi.myPets).mockResolvedValue([]);
    vi.mocked(conciergeApi.cardSetup).mockReset();
    vi.mocked(conciergeApi.cardSetup).mockResolvedValue(fakeCardSetup());
    vi.mocked(authApi.checkEmail).mockReset();
    vi.mocked(authApi.loginWithPassword).mockReset();
    vi.mocked(conciergeApi.rates).mockResolvedValue({
      fromTotal: 45,
      nights: 1,
      currency: 'NZD',
      gstInclusive: true,
    });
  });

  it('tells the guest they are talking to an AI and how their information is used', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /plan your pet/i })).toBeInTheDocument();
    // The status says a model answers, so the greeting says AI and that it can be wrong.
    expect(
      await screen.findByText(/an AI, not a person, and I can get things wrong/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/I’m the Wagstay booking assistant/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wagstay' })).toBeInTheDocument();
    expect(
      screen.getByText(/Conversations that don’t become a request are not saved/i),
    ).toBeInTheDocument();
    // Voice is turned into text by the local Whisper service, so the audio never leaves our server.
    expect(screen.getByText(/the audio is not kept/i)).toBeInTheDocument();
  });

  it('says where the assistant and voice-to-text run, as the server reports them', async () => {
    vi.mocked(conciergeApi.status).mockResolvedValue(
      statusResponse({
        aiProcessing: {
          assistant: { kind: 'anthropic', region: null },
          speech: { kind: 'transcribe', region: 'ap-southeast-4' },
          parentChat: { kind: 'other', region: null },
        },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByText(
        'Voice is turned into text by Amazon Transcribe in Melbourne, Australia; the audio is not kept by Wagstay.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How we handle your information' }));
    expect(
      screen.getByText(/The assistant runs on Anthropic’s Claude service in the United States\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We do not use your messages to train AI models\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Amazon Web Services|our own server/)).not.toBeInTheDocument();
  });

  it('makes no claim about where anything runs while the status is still loading', async () => {
    vi.mocked(conciergeApi.status).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Details of where voice-to-text runs are loading.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How we handle your information' }));
    expect(
      screen.getByText(/^Details of where the assistant runs are loading\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Amazon|Anthropic|our own server/)).not.toBeInTheDocument();
  });

  it('calls the keyword assistant an automated helper, never an AI, when no model is configured', async () => {
    vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse({ assistantMode: 'rules' }));
    renderPage();

    expect(await screen.findByText(/I understand simple phrases only/i)).toBeInTheDocument();
    expect(screen.getByText(/an automated helper, not a person/i)).toBeInTheDocument();
    expect(screen.queryByText(/I’m an AI/)).not.toBeInTheDocument();
  });

  it('puts the header, title and price on the hero band on /book, and no band in the portal', async () => {
    const standalone = render(
      <MemoryRouter initialEntries={['/book']}>
        <ConciergePage variant="standalone" />
      </MemoryRouter>,
    );
    const band = standalone.container.querySelector<HTMLElement>('.theme-hero-band');
    const currentStep = standalone.container.querySelector<HTMLElement>('[aria-current="step"]');

    expect(band).not.toBeNull();
    expect(band).toContainElement(screen.getByRole('link', { name: 'Wagstay' }));
    expect(band).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(band).toContainElement(await screen.findByText(/A night for one pet from/));
    // The steps and the chat stay on the page colour below the band.
    expect(currentStep).not.toBeNull();
    expect(band).not.toContainElement(currentStep);
    expect(band).not.toContainElement(screen.getByText(/I’m the Wagstay booking assistant/));
    standalone.unmount();

    const portal = render(
      <MemoryRouter initialEntries={['/parent/booking']}>
        <ConciergePage variant="portal" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /plan your pet/i })).toBeInTheDocument();
    expect(portal.container.querySelector('.theme-hero-band')).toBeNull();
    // The old step-by-step form asked for card details and has been removed, so the portal must
    // not link to it.
    expect(screen.queryByRole('link', { name: /step-by-step/i })).not.toBeInTheDocument();
    expect(
      portal.container.querySelector('a[href="/parent/booking/classic"]'),
    ).not.toBeInTheDocument();
    // The portal panel is glass, so the page's text sits on an opaque plate.
    expect(screen.getByRole('heading', { level: 1 }).closest('.parent-plate')).not.toBeNull();
  });

  it('shows an honest "from" price before any question', async () => {
    renderPage();

    expect(
      await screen.findByText(
        /A night for one pet from \$45\.00\. Room, food and GST are included\./,
      ),
    ).toBeInTheDocument();
  });

  it('lets the guest start with one tap instead of typing', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) => ({
      reply: 'Which dates are you thinking of?',
      needs: request.needs,
      missingFields: ['dates'],
      combos: [],
      catalogue,
      assistantMode: 'rules',
      plan: null,
      assistantAvailable: true,
      fullNights: [],
      lastStay: null,
    }));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'A stay for my dog' }));

    const request = vi.mocked(conciergeApi.chat).mock.calls[0]?.[0];
    expect(request?.trigger).toBe('choice');
    expect(request?.needs.pets.map((pet) => pet.species)).toEqual(['dog']);
    expect(await screen.findByRole('button', { name: 'Use these dates' })).toBeInTheDocument();
  });

  it('picks both dates in the chat card with the page calendar and keeps check-out after check-in', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) => ({
      reply: 'Which dates are you thinking of?',
      needs: request.needs,
      missingFields: ['dates'],
      combos: [],
      catalogue,
      assistantMode: 'rules',
      plan: null,
      assistantAvailable: true,
      fullNights: [],
      lastStay: null,
    }));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'A stay for my dog' }));
    const useDates = await screen.findByRole('button', { name: 'Use these dates' });
    const card = useDates.closest('form');
    if (!card) throw new Error('The dates card is missing');
    // Relative to today, because past days cannot be picked.
    const dropOff = addDays(todayInNewZealand(), 10);
    const pickUp = addDays(dropOff, 3);

    await chooseDate(user, within(card).getByRole('button', { name: 'Check-in date' }), dropOff);
    await chooseDate(user, within(card).getByRole('button', { name: 'Check-out date' }), pickUp);
    await act(async () => {
      await user.click(useDates);
    });

    expect(useConciergeStore.getState().needs).toMatchObject({
      startDate: dropOff,
      endDate: pickUp,
    });
  });

  it('opens the checklist check-out calendar on the check-in month and blocks days up to check-in', async () => {
    const user = userEvent.setup();
    // Far enough ahead that the check-in month is never the current month.
    const dropOff = `${Number(todayInNewZealand().slice(0, 4)) + 1}-03-10`;
    useConciergeStore.setState({ needs: { ...oneDog, startDate: dropOff, endDate: null } });
    renderPage();
    const checklist = document.getElementById('concierge-checklist');
    if (!checklist) throw new Error('The checklist is missing');

    await user.click(within(checklist).getByRole('button', { name: 'Check-out date' }));

    expect(getCalendarDayButton(dropOff)).toBeDisabled();
    expect(getCalendarDayButton(addDays(dropOff, 1))).toBeEnabled();
  });

  it('shows the stay with its total, the GST it includes and the trust facts in the panel', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^Your stay/ }));

    const panel = screen.getByRole('dialog', { name: 'Your stay' });
    expect(within(panel).getAllByText('$267.00').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/includes GST of \$34\.83/).length).toBeGreaterThan(0);
    expect(within(panel).getByText('You are only charged for confirmed stays')).toBeInTheDocument();
    expect(within(panel).getByText('Confirmed at once when there is room')).toBeInTheDocument();
  });

  it('names the full nights instead of offering options that cannot be booked', () => {
    useConciergeStore.setState({
      needs: oneDog,
      missingFields: [],
      combos: [],
      fullNights: ['2026-10-13', '2026-10-14'],
    });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Those dates are full' })).toBeInTheDocument();
    expect(
      screen.getByText(/We have no room left on Tue 13 Oct( 2026)? and Wed 14 Oct( 2026)?\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue with this stay' }),
    ).not.toBeInTheDocument();
  });

  it('accepts the priced stay on Continue, and asks for the terms only on the details step', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    withStay();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^Your stay/ }));
    // The terms are agreed once, on the details step, not here.
    expect(screen.queryByRole('checkbox', { name: /booking terms/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue with this stay' }));

    expect(conciergeApi.acceptQuote).toHaveBeenCalledWith('quote-roomier');
    expect(useConciergeStore.getState().step).toBe('details');
    expect(useConciergeStore.getState().stayPanelOpen).toBe(false);
  });

  it('offers the team instead of a dead end when no card can be saved', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.status).mockResolvedValue(
      statusResponse({ cardPayments: { processor: null, testMode: false } }),
    );
    withStay();
    renderPage();

    expect(await screen.findByText(/Card payments aren’t set up yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Your stay/ }));
    await user.click(screen.getByRole('button', { name: 'Send this plan to our team' }));

    const dialog = screen.getByRole('dialog', { name: 'Send this plan to our team' });
    const email = within(dialog).getByRole('link', { name: 'Email this plan to our team' });
    expect(email.getAttribute('href')).toMatch(/^mailto:bookings@wagstay\.example\?subject=/);
    expect(decodeURIComponent(email.getAttribute('href') ?? '')).toContain('$267.00');
    expect(
      within(dialog).getByRole('link', { name: 'Call us on 09 555 0100' }),
    ).toBeInTheDocument();
    expect(conciergeApi.acceptQuote).not.toHaveBeenCalled();
  });

  it('asks the parent for the pet’s name, the terms and the card agreement, points to each problem, and sends the request with the saved card', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.checkout).mockResolvedValue(checkoutResponse());
    signInParent();
    useConciergeStore.setState({
      needs: oneDog,
      missingFields: [],
      accepted: acceptedFor(roomierCombo.quote),
      agreedQuote: roomierCombo.quote,
    });
    useConciergeStore.getState().setVerified(AVA.email, null);
    useConciergeStore.getState().goTo('details');
    renderPage();

    // The development fake stands in for the card form, so there is no card number to type.
    expect(
      await screen.findByText('Test mode: no card is needed and nothing is charged.'),
    ).toBeInTheDocument();
    // A signed-in parent's contact details come from the account, so none are asked for.
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    expect(screen.getByText(/things to fix before sending/)).toBeInTheDocument();
    // Named in the list of things to fix, and again under the box itself.
    expect(screen.getAllByText('Tick the box to give emergency vet consent.')).toHaveLength(2);
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(conciergeApi.checkout).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Name'), 'Biscuit');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Check-in time' }), '10:30');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Check-out time' }), '16:00');
    // The full price is held when the request is sent, and charged once the stay is confirmed.
    expect(
      screen.getByText(
        'When you send this request we hold $267.00 on your card. You are only charged once your stays are confirmed: straight away when every pet is confirmed, or once our manager has decided, within 24 hours. A pet we can’t take, or don’t decide on in time, is not charged. If the card is declined, nothing is booked.',
      ),
    ).toBeInTheDocument();
    // The hold is explained once, in the card section's lead, not again in the rules list.
    expect(screen.getAllByText(/we hold \$267\.00 on your card/)).toHaveLength(1);
    expect(
      screen.getByText(
        'Cancel less than 72 hours before check-in, or don’t come on check-in day: 50% of each confirmed pet’s stay.',
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('checkbox', {
        name: /emergency vet treatment for my pet/,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: /booking terms/i }));
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    const request = vi.mocked(conciergeApi.checkout).mock.calls[0]?.[0];
    expect(request).not.toHaveProperty('contact');
    expect(request).not.toHaveProperty('verificationToken');
    // No typed signature: the agreement is recorded under the parent's own name.
    expect(request?.agreement).toMatchObject({ termsAccepted: true });
    expect(request?.stay).toEqual({ dropOffTime: '10:30', pickUpTime: '16:00' });
    expect(request?.pets).toEqual([{ newPet: { name: 'Biscuit' } }]);
    expect(request?.cardSetupId).toBe('fake_seti_acceptance-1');
    const receipt = await screen.findByRole('region', { name: 'Request receipt' });
    expect(within(receipt).getByText('PB-AAAAAA')).toBeInTheDocument();
    expect(within(receipt).getByText('Waiting for review')).toBeInTheDocument();
    expect(within(receipt).getByText('10:30 am')).toBeInTheDocument();
    expect(within(receipt).getByText('4:00 pm')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Boarding pass' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/^We’ve held \$230\.00 on your card\. Our manager decides by Wed 2 Dec /),
    ).toBeInTheDocument();
    expect(screen.getByText('This was a test: no real money moved.')).toBeInTheDocument();
    expect(screen.getByText(/latest status is always in My stays/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Do it now: Vaccination proof' })).toHaveAttribute(
      'href',
      '/parent/vaccination/booking-pet-1',
    );
  });

  it('goes back to the plan and re-checks the dates when the last place goes while sending', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.checkout).mockRejectedValue(
      new ApiError('full', 409, {
        error: { code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-12-13' }] },
      }),
    );
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) => ({
      reply: '',
      needs: request.needs,
      missingFields: [],
      combos: [],
      catalogue,
      assistantMode: 'rules',
      plan: null,
      assistantAvailable: true,
      fullNights: ['2026-12-13'],
      lastStay: null,
    }));
    openFilledDetails();
    renderPage();

    await screen.findByText('Test mode: no card is needed and nothing is charged.');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    expect(conciergeApi.checkout).toHaveBeenCalledTimes(1);
    expect(useConciergeStore.getState().step).toBe('plan');
    expect(
      await screen.findByText(
        'Sorry, some of those nights just filled up. Please choose other dates.',
      ),
    ).toBeInTheDocument();
    expect(conciergeApi.chat).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'checklist' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Those dates are full' }),
    ).toBeInTheDocument();
  });

  it('lets a first-time guest book without signing in, making their account with the booking', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.checkout).mockResolvedValue(checkoutResponse());
    useConciergeStore.setState({
      needs: oneDog,
      agreedNeeds: oneDog,
      missingFields: [],
      // A plan saved on the old sign-in step opens the details.
      step: 'verify',
      accepted: acceptedFor(roomierCombo.quote),
      agreedQuote: roomierCombo.quote,
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'A few details' })).toBeInTheDocument();
    expect(useConciergeStore.getState().step).toBe('details');
    expect(screen.queryByRole('heading', { name: 'Sign in to continue' })).not.toBeInTheDocument();
    // The card waits for the email its account is made with.
    expect(
      screen.getByText('Enter your email above, then add your card here.'),
    ).toBeInTheDocument();
    expect(conciergeApi.cardSetup).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Email'), 'new.guest@example.test');
    await user.type(screen.getByLabelText('Choose a password'), 'Sunny-days-42');
    expect(
      await screen.findByText('Test mode: no card is needed and nothing is charged.'),
    ).toBeInTheDocument();
    expect(conciergeApi.cardSetup).toHaveBeenCalledWith(
      expect.objectContaining({ guestEmail: 'new.guest@example.test' }),
    );
    await user.type(screen.getByLabelText('First name'), 'Nina');
    await user.type(screen.getByLabelText('Last name'), 'Park');
    await user.type(screen.getByLabelText('Your mobile'), '021 555 0142');
    await user.type(screen.getByLabelText('Name'), 'Biscuit');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Check-in time' }), '10:30');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Check-out time' }), '16:00');
    await user.click(screen.getByRole('checkbox', { name: /I agree to the booking terms/ }));
    await user.click(screen.getByRole('checkbox', { name: /emergency vet treatment/ }));
    await user.click(screen.getByRole('button', { name: 'Send booking request' }));

    await waitFor(() => expect(conciergeApi.checkout).toHaveBeenCalledTimes(1));
    const request = vi.mocked(conciergeApi.checkout).mock.calls[0]?.[0];
    expect(request?.newAccount).toEqual({
      email: 'new.guest@example.test',
      password: 'Sunny-days-42',
    });
    expect(request?.verificationToken).toBeUndefined();
    expect(request?.contact).not.toHaveProperty('password');
    // It types a whole form: slower than the 5 second default when the full suite runs in parallel.
  }, 20_000);

  it('sends a guest whose email already has an account to sign in, keeping what they typed', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.cardSetup).mockRejectedValueOnce(
      new ApiError('This email already has a Wagstay account.', 409, {
        error: { code: 'CONCIERGE_ACCOUNT_EXISTS', message: 'exists' },
      }),
    );
    useConciergeStore.setState({
      needs: oneDog,
      agreedNeeds: oneDog,
      missingFields: [],
      step: 'details',
      accepted: acceptedFor(roomierCombo.quote),
      agreedQuote: roomierCombo.quote,
    });
    renderPage();

    await user.type(await screen.findByLabelText('Email'), 'ava@example.test');
    await user.tab();

    // The card is set up after a short pause in typing, which a loaded test run can stretch.
    expect(
      await screen.findByText(/already has an account/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ava@example.test');
    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThan(0);
  });

  it('signs a returning owner in from the header without leaving the plan', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.checkEmail).mockResolvedValue({ ok: true, status: 200, data: {} });
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: { user: { id: 'owner-1', ...AVA } } },
    });
    withStay();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Booked with us before? Sign in' }));
    const dialog = screen.getByRole('dialog', { name: 'Booked with us before? Sign in' });
    await user.type(within(dialog).getByLabelText('Email address'), AVA.email);
    await user.type(within(dialog).getByLabelText('Password'), 'Password#1');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    });

    expect(within(dialog).getByRole('status')).toHaveTextContent(/You’re signed in/);
    // The form is gone; the result's own Close button (not the header's) has the keyboard.
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[1] as HTMLElement);
    expect(screen.getByRole('link', { name: 'My pet centre' })).toBeInTheDocument();
    // The plan is untouched: the stay is still priced and the step has not moved.
    expect(useConciergeStore.getState().stayQuote?.total).toBe(267);
    expect(useConciergeStore.getState().step).toBe('plan');
  });

  it('never shows a made-up contact address when none is configured', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.status).mockResolvedValue(
      statusResponse({ contact: { email: null, phone: null } }),
    );
    renderPage();

    // The header link (the greeting also offers one as an answer button).
    const [headerLink] = screen.getAllByRole('button', { name: 'Talk to a person' });
    if (!headerLink) throw new Error('Talk to a person is missing');
    await user.click(headerLink);

    const dialog = await screen.findByRole('dialog', { name: 'Send this plan to our team' });
    expect(within(dialog).queryByRole('link', { name: /Email this plan/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/contact details aren’t available/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copy my plan' })).toBeInTheDocument();
  });

  // A signed-in parent already has a chat with our team, so "Talk to a person" opens it.
  it('takes a signed-in parent to their chat with the team', async () => {
    const user = userEvent.setup();
    signInParent();
    render(
      <MemoryRouter initialEntries={['/book']}>
        <Routes>
          <Route path="/book" element={<ConciergePage variant="standalone" />} />
          <Route path="/parent/ai-chat" element={<h1>Parent chat</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    const [headerLink] = screen.getAllByRole('button', { name: 'Talk to a person' });
    if (!headerLink) throw new Error('Talk to a person is missing');
    await user.click(headerLink);

    expect(await screen.findByRole('heading', { name: 'Parent chat' })).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Send this plan to our team' }),
    ).not.toBeInTheDocument();
  });

  it('does not send while an input method is still composing', async () => {
    vi.mocked(conciergeApi.chat).mockResolvedValue({
      reply: 'ok',
      needs: useConciergeStore.getState().needs,
      missingFields: ['dates'],
      combos: [],
      catalogue,
      assistantMode: 'rules',
      plan: null,
      assistantAvailable: true,
      fullNights: [],
      lastStay: null,
    });
    renderPage();
    const box = screen.getByPlaceholderText(/two dogs, 12 to 15 October/i);

    fireEvent.change(box, { target: { value: '两只' } });
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229, isComposing: true });
    expect(conciergeApi.chat).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(conciergeApi.chat).toHaveBeenCalledTimes(1);
  });

  it('switches every label to Chinese', async () => {
    renderPage();

    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(
      screen.getByRole('heading', { level: 1, name: '为毛孩子安排一次住宿' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/是 AI，不是真人/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '给狗狗安排住宿' })).toBeInTheDocument();
    expect(englishWordsIn(document.body)).toEqual([]);
  });

  it('says where the assistant runs in Chinese, naming the providers as they are', async () => {
    vi.mocked(conciergeApi.status).mockResolvedValue(
      statusResponse({
        aiProcessing: {
          assistant: { kind: 'bedrock', region: 'ap-southeast-2' },
          speech: { kind: 'transcribe', region: 'ap-southeast-2' },
          parentChat: { kind: 'bedrock', region: 'ap-southeast-2' },
        },
      }),
    );
    const user = userEvent.setup();
    renderPage();
    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(
      await screen.findByText(
        '语音由位于澳大利亚悉尼的 Amazon Transcribe 转成文字，Wagstay 不保存音频。',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我们如何处理你的信息' }));
    expect(
      screen.getByText(/助手运行在位于澳大利亚悉尼的 Amazon Bedrock 上。/),
    ).toBeInTheDocument();
    expect(englishWordsIn(document.body)).toEqual([]);
  });

  it('shows a named pet in the stay card with its kind and size chosen', async () => {
    useConciergeStore.setState({
      needs: {
        ...oneDog,
        pets: [
          {
            name: 'Mochi',
            species: 'dog',
            size: 'large',
            needsMedication: false,
            firstTimeBoarding: null,
          },
        ],
      },
    });
    renderPage();
    const stayCard = (): HTMLElement =>
      screen.getByRole('region', { name: /^(Your stay|你的住宿)$/ });

    const pet = within(stayCard()).getByRole('group', { name: 'Pet 1 · Mochi' });
    expect(within(pet).getByRole('radio', { name: 'Dog' })).toBeChecked();
    expect(within(pet).getByRole('radio', { name: 'Large' })).toBeChecked();

    act(() => useConciergeStore.getState().setLocale('zh'));

    const petInChinese = within(stayCard()).getByRole('group', { name: '宠物 1 · Mochi' });
    expect(within(petInChinese).getByRole('radio', { name: '狗狗' })).toBeChecked();
    expect(within(petInChinese).getByRole('radio', { name: '大型' })).toBeChecked();
  });
});
