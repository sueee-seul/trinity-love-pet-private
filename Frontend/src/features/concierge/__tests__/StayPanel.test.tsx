import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../pet-parent/api/bookingApi';
import { conciergeApi } from '../api/conciergeApi';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeNeeds } from '../types';
import {
  acceptedFor,
  catalogue,
  chatAnswer,
  combos,
  oneDog,
  quoteFor,
  renderPage,
  resetPage,
  roomierCombo,
  simpleCombo,
  withStay,
} from './conciergePageFixtures';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';

/**
 * The floating stay: it opens when options arrive or the guest clicks into the chat, shows the
 * suggested combos with the recommendation explained, lets any line be changed with the server
 * pricing the result, and continues with the signed price of the stay as it stands.
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

const panel = (name = 'Your stay'): HTMLElement => screen.getByRole('dialog', { name });

const openPanel = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: /^Your stay/ }));
  return panel();
};

/** The server's price once grooming is added to the recommended stay. */
const groomedQuote = quoteFor(
  [{ roomId: 'room-deluxe', foodId: 'food-house', addonIds: ['addon-walk', 'addon-grooming'] }],
  'quote-groomed',
);

const groomingAddon = catalogue.addons[2];
if (!groomingAddon) throw new Error('The fixture catalogue needs three add-ons');

describe('the stay panel', () => {
  beforeEach(() => {
    resetPage();
    vi.mocked(conciergeApi.chat).mockReset();
    vi.mocked(conciergeApi.priceSelection).mockReset();
    vi.mocked(conciergeApi.acceptQuote).mockReset();
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) =>
      chatAnswer({ needs: request.needs, combos }),
    );
  });

  it('keeps the illustrated care sample optional without changing the priced stay', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();
    const dialog = await openPanel(user);
    const sampleToggle = within(dialog).getByText('See an example daily update', { exact: true });
    const sample = sampleToggle.closest('details');
    expect(sample).not.toHaveAttribute('open');
    const suggestedStays = within(dialog).getByRole('region', { name: 'Suggested stays' });
    expect(
      within(suggestedStays).getAllByRole('img', { name: 'AI illustration: Quiet rest' }),
    ).toHaveLength(combos.length);
    expect(
      within(dialog).getByRole('img', { name: 'AI illustration: Grooming or a bath' }),
    ).toBeInTheDocument();

    await user.click(sampleToggle);

    expect(sample).toHaveAttribute('open');
    expect(
      within(dialog).getByRole('img', { name: 'AI illustration: Meals and fresh water' }),
    ).toBeInTheDocument();
    expect(useConciergeStore.getState().stayQuote?.quoteToken).toBe(roomierCombo.quote.quoteToken);
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('does not advertise grooming art when grooming is absent from the catalogue', async () => {
    const user = userEvent.setup();
    withStay();
    useConciergeStore.setState({
      catalogue: {
        ...catalogue,
        addons: catalogue.addons.filter((addon) => addon.id !== groomingAddon.id),
      },
    });
    renderPage();
    const dialog = await openPanel(user);
    expect(
      within(dialog).queryByRole('img', { name: 'AI illustration: Grooming or a bath' }),
    ).not.toBeInTheDocument();
  });

  it('opens when a reply brings the options, with a chip under that reply', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.chat).mockResolvedValueOnce(
      chatAnswer({ reply: 'Your options are ready.', combos }),
    );
    renderPage();

    await user.type(screen.getByRole('textbox', { name: /Booking assistant/ }), 'One large dog');
    await user.keyboard('{Enter}');

    await screen.findByRole('dialog', { name: 'Your stay' });
    expect(screen.getByRole('button', { name: 'Open your stay' })).toBeInTheDocument();
  });

  it('opens when the chat box gets focus once there is a stay, keeping the cursor in the box', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();
    expect(screen.queryByRole('dialog', { name: 'Your stay' })).not.toBeInTheDocument();

    const box = screen.getByRole('textbox', { name: /Booking assistant/ });
    await user.click(box);

    expect(panel()).toBeInTheDocument();
    expect(box).toHaveFocus();
  });

  it('closes on Escape and hands focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();
    const opener = screen.getByRole('button', { name: /^Your stay/ });

    await user.click(opener);
    expect(within(panel()).getByRole('heading', { name: 'Your stay' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Your stay' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('shows the recommended combo with its tag and reason, and applies a combo with one press', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();

    const dialog = await openPanel(user);
    const recommended = within(dialog).getByText('Recommended for you').closest('li');
    expect(recommended).toHaveTextContent(roomierCombo.reason);
    expect(recommended).toHaveTextContent('In use');

    await user.click(within(dialog).getByRole('button', { name: 'Use this combo' }));

    const state = useConciergeStore.getState();
    expect(state.appliedComboId).toBe(simpleCombo.id);
    expect(state.stayQuote).toEqual(simpleCombo.quote);
    expect(state.selection).toEqual(simpleCombo.quote.selection);
    expect(within(dialog).getAllByText('$174.00').length).toBeGreaterThan(0);
    expect(conciergeApi.priceSelection).not.toHaveBeenCalled();
  });

  it('prices a ticked add-on through the server and shows the total it returns', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.priceSelection).mockResolvedValue({ quote: groomedQuote });
    withStay();
    renderPage();

    const dialog = await openPanel(user);
    await user.click(within(dialog).getByRole('checkbox', { name: /Grooming: bath and brush/ }));

    await waitFor(() => expect(conciergeApi.priceSelection).toHaveBeenCalledTimes(1));
    expect(vi.mocked(conciergeApi.priceSelection).mock.calls[0]?.[0]).toEqual({
      needs: oneDog,
      selection: {
        pets: [
          {
            roomId: 'room-deluxe',
            foodId: 'food-house',
            addonIds: ['addon-walk', 'addon-grooming'],
          },
        ],
      },
      locale: 'en',
    });
    expect(await within(dialog).findByText('$322.00')).toBeInTheDocument();
    expect(within(dialog).queryByText('In use')).not.toBeInTheDocument();
  });

  it('keeps the last priced stay and says why when the server refuses a combination', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.priceSelection).mockRejectedValue(
      new ApiError('refused', 422, { error: { code: 'CONCIERGE_SELECTION_INVALID' } }),
    );
    withStay();
    renderPage();

    const dialog = await openPanel(user);
    await user.click(within(dialog).getByRole('checkbox', { name: /Grooming: bath and brush/ }));

    expect(
      await within(dialog).findByText(
        'That combination can’t be booked, so we kept your last priced stay.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('checkbox', { name: /Grooming: bath and brush/ }),
    ).not.toBeChecked();
    expect(within(dialog).getAllByText('$267.00').length).toBeGreaterThan(0);
  });

  it('sends the priced stay’s token on Continue', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.acceptQuote).mockResolvedValue(acceptedFor(roomierCombo.quote));
    withStay();
    renderPage();

    const dialog = await openPanel(user);
    await user.click(within(dialog).getByRole('button', { name: 'Continue with this stay' }));

    expect(conciergeApi.acceptQuote).toHaveBeenCalledWith('quote-roomier');
    expect(useConciergeStore.getState().step).toBe('details');
  });

  it('ticks and locks what the server always adds, and hides dog-only add-ons for a cat', async () => {
    const user = userEvent.setup();
    const catOnMedication: ConciergeNeeds = {
      ...oneDog,
      pets: [{ species: 'cat', size: null, needsMedication: true, firstTimeBoarding: null }],
    };
    const catStay = quoteFor(
      [{ roomId: 'room-standard', foodId: 'food-house', addonIds: ['addon-medication'] }],
      'quote-cat',
    );
    useConciergeStore.setState({
      needs: catOnMedication,
      pricedNeeds: catOnMedication,
      missingFields: [],
      combos: [{ ...simpleCombo, quote: catStay }],
      catalogue: {
        ...catalogue,
        addons: [{ ...groomingAddon, compulsory: true }, ...catalogue.addons.slice(0, 2)],
      },
      selection: catStay.selection,
      stayQuote: catStay,
      appliedComboId: simpleCombo.id,
    });
    renderPage();

    const dialog = await openPanel(user);
    const pet = within(dialog).getByRole('group', { name: 'Pet 1 · Cat' });
    const medication = within(pet).getByRole('checkbox', { name: /Medication administration/ });
    expect(medication).toBeChecked();
    expect(medication).toBeDisabled();
    expect(medication).toHaveAccessibleDescription('Included because this pet takes medication');
    const grooming = within(pet).getByRole('checkbox', { name: /Grooming: bath and brush/ });
    expect(grooming).toBeChecked();
    expect(grooming).toBeDisabled();
    expect(grooming).toHaveAccessibleDescription('Always included');
    expect(within(pet).queryByRole('checkbox', { name: /Outdoor walk/ })).not.toBeInTheDocument();
  });

  it('reads in Chinese, with the services named in Chinese', async () => {
    const user = userEvent.setup();
    withStay();
    renderPage();
    act(() => useConciergeStore.getState().setLocale('zh'));

    await user.click(screen.getByRole('button', { name: /^我的住宿/ }));

    const dialog = panel('我的住宿');
    expect(within(dialog).getByRole('button', { name: '按这个住宿继续' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: '宠物 1 · 狗狗' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /豪华套房/ })).toBeChecked();
    // The combo reasons come from the server in the language of the turn that fetched them.
    const reasons = combos.flatMap((combo) => combo.reason.match(/[A-Za-z']+/g) ?? []);
    expect(englishWordsIn(dialog, [...reasons, 'A', 'larger', 'room', 'with', 'window'])).toEqual(
      [],
    );
  });
});
