import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import type { Pet } from '../../pet-parent/types/booking';
import { conciergeApi } from '../api/conciergeApi';
import { ConciergePage } from '../components/ConciergePage';
import { useAccountPetsStore } from '../store/accountPets';
import { useConciergeStore } from '../store/conciergeStore';
import { useLastStayStore } from '../store/lastStay';
import type { ConciergeNeeds } from '../types';
import {
  acceptedFor,
  chatAnswer,
  combos,
  oneDog,
  resetPage,
  roomierCombo,
  sent,
  simpleCombo,
  withStay,
} from './conciergePageFixtures';
import { lastStayFor } from './fixtures';

/**
 * A signed-in parent is asked each fact once: saved pets come with what the account knows, a
 * pet's own link preselects it, a linked pet is not asked about again, the name they sign with
 * comes from the account, and the booking terms are agreed with one box, on one screen.
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
    fetchLastStay: vi.fn(),
  },
}));

vi.mock('../hooks/useSignedInPetOwner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSignedInPetOwner')>()),
  refreshSession: vi.fn(async () => undefined),
}));

const max: Pet = {
  id: 'pet-max',
  name: 'Max',
  species: 'dog',
  breed: 'Labrador',
  firstTimeBoarding: false,
  needsMedication: true,
};
const rex: Pet = {
  id: 'pet-rex',
  name: 'Rex',
  species: 'dog',
  firstTimeBoarding: null,
  needsMedication: null,
};

const TERMS_BOX = 'I agree to the booking terms';

/** Shows the address the booking page has written, so a test can open it again. */
const AddressBar: React.FC = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="address">{`${pathname}${search}`}</output>;
};

const address = (): string => screen.getByTestId('address').textContent ?? '';

/** Renders the booking page and returns how to leave it. */
const renderPortal = (path = '/parent/booking'): (() => void) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConciergePage variant="portal" />
      <AddressBar />
    </MemoryRouter>,
  ).unmount;

const savedPetChips = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Who’s staying?' });

/** Max (linked) and a second dog nobody has named yet, agreed and on the details step. */
const onDetailsWithMaxLinked = (): void => {
  const firstDog = oneDog.pets[0];
  if (!firstDog) throw new Error('The fixture needs a dog');
  const needs: ConciergeNeeds = {
    ...oneDog,
    pets: [
      { ...firstDog, name: 'Max' },
      { species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null },
    ],
  };
  useConciergeStore.setState({
    needs,
    agreedNeeds: needs,
    missingFields: [],
    accepted: acceptedFor(roomierCombo.quote),
    agreedQuote: roomierCombo.quote,
    step: 'details',
    savedPetLinks: ['pet-max', null],
    savedPets: { 'pet-max': { name: 'Max', species: 'dog' } },
  });
};

describe('a signed-in parent is asked each fact once', () => {
  beforeEach(() => {
    resetPage();
    useAccountPetsStore.getState().clear();
    useLastStayStore.getState().clear();
    vi.mocked(conciergeApi.myPets).mockReset();
    vi.mocked(conciergeApi.myPets).mockResolvedValue([max, rex]);
    vi.mocked(conciergeApi.fetchLastStay).mockReset();
    vi.mocked(conciergeApi.fetchLastStay).mockResolvedValue({ lastStay: null });
    vi.mocked(conciergeApi.acceptQuote).mockReset();
    vi.mocked(conciergeApi.checkout).mockReset();
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      chatAnswer({ needs: request.needs, combos }),
    );
    useAuthStore.getState().login({
      email: 'ava@example.test',
      name: 'Ava Mitchell',
      is_employee: false,
      is_pet_owner: true,
    });
  });

  it('asks for the saved pets once per visit, however many parts of the page use them', async () => {
    withStay();
    renderPortal();

    expect(within(await savedPetChips()).getByRole('button', { name: /Max/ })).toBeVisible();
    act(() => {
      useConciergeStore.setState({
        accepted: acceptedFor(roomierCombo.quote),
        agreedQuote: roomierCombo.quote,
        agreedNeeds: oneDog,
        step: 'details',
      });
    });

    expect(await screen.findByRole('combobox', { name: 'Choose a saved pet' })).toBeVisible();
    expect(conciergeApi.myPets).toHaveBeenCalledTimes(1);
  });

  it('opens with the pet from a "Book a stay" link chosen, with what the account knows', async () => {
    renderPortal('/parent/booking?pet=pet-max');
    const chips = await savedPetChips();

    await waitFor(() =>
      expect(within(chips).getByRole('button', { name: /Max/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(within(chips).getByRole('button', { name: /Rex/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const state = useConciergeStore.getState();
    expect(state.savedPetLinks).toEqual(['pet-max']);
    expect(state.needs.pets).toEqual([
      expect.objectContaining({ name: 'Max', needsMedication: true, firstTimeBoarding: false }),
    ]);
  });

  it('ignores a link to a pet that is not on the account', async () => {
    renderPortal('/parent/booking?pet=someone-elses-pet');
    await savedPetChips();

    expect(useConciergeStore.getState().needs.pets).toEqual([]);
  });

  it('starts a new plan for the linked pet when the last request was already sent', async () => {
    useConciergeStore.setState({ step: 'done', checkoutResult: sent });
    renderPortal('/parent/booking?pet=pet-rex');

    await waitFor(() => expect(useConciergeStore.getState().step).toBe('plan'));
    expect(useConciergeStore.getState().savedPetLinks).toEqual(['pet-rex']);
  });

  it('uses a pet link once, so opening the receipt again never starts over', async () => {
    useConciergeStore.setState({ step: 'done', checkoutResult: sent });
    const leave = renderPortal('/parent/booking?pet=pet-rex');
    await waitFor(() => expect(useConciergeStore.getState().savedPetLinks).toEqual(['pet-rex']));
    await waitFor(() => expect(address()).toBe('/parent/booking'));

    // The new request is sent, and its receipt gets its own history entry.
    act(() => useConciergeStore.getState().setCheckoutResult(sent));
    await waitFor(() => expect(address()).toBe('/parent/booking?step=done'));
    const receipt = address();
    leave();

    // A refresh, or Back from My stays, opens that address again once the pets have loaded.
    renderPortal(receipt);
    await waitFor(() => expect(useAccountPetsStore.getState().status).toBe('ready'));
    expect(useConciergeStore.getState().step).toBe('done');
    expect(screen.getByText(/PB-AAAAAA/)).toBeVisible();
  });

  it('shows a linked pet read-only with Change, and asks only about pets not linked yet', async () => {
    const user = userEvent.setup();
    onDetailsWithMaxLinked();
    renderPortal();
    const pets = screen.getByRole('group', { name: 'Your pets' });

    expect(within(pets).getByText('Max', { selector: 'p' })).toBeVisible();
    expect(within(pets).getByText('One of your saved pets')).toBeVisible();
    // The second dog offers Rex only: Max is already coming.
    const picker = await within(pets).findByRole('combobox', { name: 'Choose a saved pet' });
    expect(
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['A new pet', 'Rex']);
    expect(within(pets).getAllByRole('textbox', { name: 'Name' })).toHaveLength(1);

    await user.click(within(pets).getByRole('button', { name: 'Change Max' }));

    const pickers = within(pets).getAllByRole('combobox', { name: 'Choose a saved pet' });
    expect(pickers).toHaveLength(2);
    expect(pickers[0]).toHaveFocus();
  });

  it('offers "same as last time" only with an earlier stay, and says it to the assistant', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.fetchLastStay).mockResolvedValue({ lastStay: lastStayFor() });
    renderPortal();

    const chip = await screen.findByRole('button', { name: 'Same as last time' });
    expect(screen.getByRole('button', { name: 'A stay for my dog' })).toBeVisible();
    await user.click(chip);

    await waitFor(() => expect(conciergeApi.chat).toHaveBeenCalledTimes(1));
    const request = vi.mocked(conciergeApi.chat).mock.calls[0]?.[0];
    expect(request?.trigger).toBe('message');
    expect(request?.messages).toEqual([{ role: 'user', text: 'Same as last time' }]);
    expect(conciergeApi.fetchLastStay).toHaveBeenCalledTimes(1);
  });

  it('never offers "same as last time" to a parent with no earlier stay', async () => {
    renderPortal();

    expect(await screen.findByRole('button', { name: 'A stay for my dog' })).toBeVisible();
    await waitFor(() => expect(conciergeApi.fetchLastStay).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Same as last time' })).not.toBeInTheDocument();
  });

  it('asks for no typed name: the agreement is recorded under the account’s own name', () => {
    onDetailsWithMaxLinked();
    renderPortal();

    expect(screen.queryByLabelText('Sign with your full name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Use “/ })).not.toBeInTheDocument();
  });

  it('asks for the booking terms with one unticked box on the details step, and nowhere else', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    vi.mocked(conciergeApi.checkout).mockResolvedValue(sent);
    withStay();
    renderPortal();

    expect(screen.queryAllByRole('checkbox', { name: /booking terms/i })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /^Your stay/ }));
    await user.click(screen.getByRole('button', { name: 'Continue with this stay' }));

    const box = await screen.findByRole('checkbox', { name: TERMS_BOX });
    expect(screen.getAllByRole('checkbox', { name: /booking terms/i })).toHaveLength(1);
    expect(box).not.toBeChecked();
    expect(screen.getByText(/are our own rule, not a law/)).toBeVisible();
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Choose a saved pet' }),
      'pet-max',
    );
    await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(conciergeApi.checkout).not.toHaveBeenCalled();

    await user.click(box);
    await user.click(
      screen.getByRole('checkbox', {
        name: /emergency vet treatment for my pet/,
      }),
    );
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Send booking request' }));
    });

    expect(conciergeApi.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        pets: [{ existingPetId: 'pet-max' }],
        agreement: expect.objectContaining({ termsAccepted: true, vetConsentAccepted: true }),
      }),
    );
  });

  it('asks for the terms again when the parent goes back and continues with another stay', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.acceptQuote)
      .mockResolvedValueOnce(acceptedFor(roomierCombo.quote))
      .mockResolvedValueOnce(acceptedFor(simpleCombo.quote));
    withStay();
    renderPortal();

    await user.click(screen.getByRole('button', { name: /^Your stay/ }));
    await user.click(screen.getByRole('button', { name: 'Continue with this stay' }));
    await user.click(await screen.findByRole('checkbox', { name: TERMS_BOX }));
    expect(screen.getByRole('checkbox', { name: TERMS_BOX })).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Change dates or stay/ }));
    await user.click(await screen.findByRole('button', { name: /^Your stay/ }));
    const panel = screen.getByRole('dialog', { name: 'Your stay' });
    await user.click(
      within(panel).getAllByRole('button', { name: 'Use this combo' })[0] as HTMLElement,
    );
    await user.click(within(panel).getByRole('button', { name: 'Continue with this stay' }));

    expect(conciergeApi.acceptQuote).toHaveBeenLastCalledWith('quote-simple');
    expect(await screen.findByRole('checkbox', { name: TERMS_BOX })).not.toBeChecked();
  });
});
