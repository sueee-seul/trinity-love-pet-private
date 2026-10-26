import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDate } from '../../../../shared/components/ui/date/testing';
import { ApiError } from '../../api/bookingApi';
import {
  fetchAddOnCatalogue,
  previewExtension,
  requestAddOn,
  requestExtension,
  requestTimes,
} from '../../api/stayChangesApi';
import { bookedStay } from '../../components/stays/__tests__/stayFixtures';
import type { PetStay } from '../../types/stays';
import { MyStaysPage } from '../MyStaysPage';

vi.mock('../../api/stayChangesApi', () => ({
  previewCancellation: vi.fn(),
  cancelStay: vi.fn(),
  previewReschedule: vi.fn(),
  rescheduleStay: vi.fn(),
  previewExtension: vi.fn(),
  requestExtension: vi.fn(),
  fetchAddOnCatalogue: vi.fn(),
  requestAddOn: vi.fn(),
  requestTimes: vi.fn(),
}));

/** What the server answers once a change is saved as a request for our manager. */
const sentRequest = {
  id: 'request-1',
  bookingId: 'booking-1',
  bookingPetId: null,
  details: { kind: 'extend' as const, endDate: '2026-12-19' },
  quotedAmount: 86,
  status: 'pending' as const,
  refusalReason: null,
  summary: "extend Biscuit's stay to 19 Dec 2026 ($86.00)",
  createdAt: '2026-12-12T22:00:00.000Z',
  decidedAt: null,
};

const REQUEST_SENT =
  'Request sent. Our manager will check it, and you will hear the answer in your notifications and in the chat. Nothing changes until it is approved.';

/** 11:00 on Sun 13 Dec 2026 in Auckland: Biscuit's second day in, check-out due Tue 15 Dec 16:00. */
const NOW = new Date('2026-12-12T22:00:00Z');

/** Biscuit, checked in and staying. */
const biscuit = bookedStay({ status: 'staying_now', checkInOutcome: 'checked_in' });
/** Mochi, approved for a later week on another booking. */
const mochi = bookedStay({
  bookingPetId: 'bp-mochi',
  bookingId: 'booking-2',
  pet: { id: 'pet-mochi', name: 'Mochi' },
  dropOffAt: '2026-12-19T21:30:00.000Z',
  pickUpAt: '2026-12-22T03:00:00.000Z',
});

const extension = {
  currentEndDate: '2026-12-15',
  newEndDate: '2026-12-19',
  addedNights: 4,
  pets: [{ bookingPetId: 'bp-biscuit', petName: 'Biscuit', nightlyRate: 21.5, amount: 86 }],
  amount: 86,
  settlement: 'card' as const,
};

const catalogue = {
  offers: [
    {
      serviceId: 'svc-walk',
      name: 'Outdoor Walk',
      description: 'A 30 minute walk.',
      price: 15,
      priceUnit: 'per day',
    },
    { serviceId: 'svc-bath', name: 'Bath', description: null, price: 40, priceUnit: 'per stay' },
  ],
  days: ['2026-12-13', '2026-12-14'],
  settlement: 'card' as const,
};

function SearchProbe(): ReactElement {
  return <span data-testid="search">{useLocation().search}</span>;
}

const renderStays = (
  stays: PetStay[],
  path = '/parent/stays',
): ReturnType<typeof userEvent.setup> => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <MyStaysPage stays={stays} />
      <SearchProbe />
    </MemoryRouter>,
  );
  return user;
};

const card = (petName: string): HTMLElement => screen.getByRole('article', { name: petName });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('changes while the pet is staying', () => {
  it('offers the three in-stay changes on a stay under way, and only the time before check-in', () => {
    renderStays([biscuit, mochi]);

    const staying = within(card('Biscuit'));
    for (const name of ['Extend the stay', 'Add a walk or playtime', 'Change time']) {
      expect(staying.getByRole('button', { name })).toBeInTheDocument();
    }
    // Early pick-up was removed on 7 Oct 2026; leaving early is arranged with the team.
    expect(staying.queryByRole('button', { name: 'Pick up early' })).not.toBeInTheDocument();
    expect(staying.queryByRole('button', { name: 'Cancel stay' })).not.toBeInTheDocument();

    const approved = within(card('Mochi'));
    expect(approved.getByRole('button', { name: 'Change time' })).toBeInTheDocument();
    expect(approved.getByRole('button', { name: 'Change dates' })).toBeInTheDocument();
    for (const name of ['Extend the stay', 'Add a walk or playtime']) {
      expect(approved.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('prices the added nights first, then asks our manager at that price', async () => {
    vi.mocked(previewExtension).mockResolvedValue(extension);
    vi.mocked(requestExtension).mockResolvedValue(sentRequest);
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Extend the stay' }));
    const dialog = screen.getByRole('dialog', { name: 'Extend the stay' });
    expect(dialog).toHaveTextContent('Check-out is now Tue 15 Dec.');
    await chooseDate(
      user,
      within(dialog).getByRole('button', { name: /New check-out date/ }),
      '2026-12-19',
    );
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Check the price' }));
    });

    expect(previewExtension).toHaveBeenCalledWith('booking-1', '2026-12-19');
    const summary = within(dialog).getByRole('status');
    expect(summary).toHaveTextContent(
      'Check-out moves to Sat 19 Dec, 4 nights more. The added nights cost $86.00.',
    );
    expect(summary).toHaveTextContent('This is charged to your saved card now.');

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Send request ($86.00)' }));
    });

    expect(requestExtension).toHaveBeenCalledWith('booking-1', {
      endDate: '2026-12-19',
      expectedAmount: 86,
    });
    expect(screen.getByRole('status')).toHaveTextContent(REQUEST_SENT);
    expect(screen.queryByRole('dialog', { name: 'Extend the stay' })).not.toBeInTheDocument();
  });

  it('says more nights are a request, added to the bill only if our manager approves', async () => {
    const toBill = { ...extension, settlement: 'desk' as const };
    vi.mocked(previewExtension).mockResolvedValue(toBill);
    vi.mocked(requestExtension).mockResolvedValue(sentRequest);
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Extend the stay' }));
    const dialog = screen.getByRole('dialog', { name: 'Extend the stay' });
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Check the price' }));
    });

    const summary = within(dialog).getByRole('status');
    expect(summary).toHaveTextContent('The added nights cost $86.00.');
    expect(summary).toHaveTextContent(
      'This is a request for our manager. If approved, it is added to your bill, paid at the desk when you check out.',
    );
    expect(summary).not.toHaveTextContent('charged to your saved card');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Send request ($86.00)' }));
    });

    expect(requestExtension).toHaveBeenCalledWith('booking-1', {
      endDate: '2026-12-16',
      expectedAmount: 86,
    });
    expect(screen.getByRole('status')).toHaveTextContent(REQUEST_SENT);
  });

  it('loads the add-ons, names the service and total on the button, and asks at that price', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue(catalogue);
    vi.mocked(requestAddOn).mockResolvedValue(sentRequest);
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Add a walk or playtime' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a walk or playtime' });
    expect(
      await within(dialog).findByRole('radio', { name: /Outdoor Walk, \$15\.00 per day/ }),
    ).toBeChecked();
    expect(fetchAddOnCatalogue).toHaveBeenCalledWith('booking-1');

    await user.selectOptions(within(dialog).getByLabelText('Day'), '2026-12-14');
    await user.selectOptions(within(dialog).getByLabelText('How many'), '2');
    const confirm = within(dialog).getByRole('button', { name: 'Ask for 2 Outdoor Walk ($30.00)' });
    expect(dialog).toHaveTextContent('This is charged to your saved card now.');

    // A service priced for the stay is not counted.
    await user.click(within(dialog).getByRole('radio', { name: /Bath, \$40\.00 per stay/ }));
    expect(within(dialog).queryByLabelText('How many')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Ask for 1 Bath ($40.00)' })).toBeEnabled();
    await user.click(within(dialog).getByRole('radio', { name: /Outdoor Walk, \$15\.00 per day/ }));
    expect(dialog).toHaveTextContent('A 30 minute walk.');
    await user.selectOptions(within(dialog).getByLabelText('How many'), '2');

    await act(async () => {
      await user.click(confirm);
    });

    expect(requestAddOn).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      serviceId: 'svc-walk',
      date: '2026-12-14',
      quantity: 2,
      expectedAmount: 30,
    });
    expect(screen.getByRole('status')).toHaveTextContent(REQUEST_SENT);
  });

  it('says an add-on is a request, paid at the desk at check-out if approved', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue({ ...catalogue, settlement: 'desk' });
    vi.mocked(requestAddOn).mockResolvedValue(sentRequest);
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Add a walk or playtime' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a walk or playtime' });
    await within(dialog).findByRole('radio', { name: /Outdoor Walk/ });
    expect(dialog).toHaveTextContent(
      'This is a request for our manager. If approved, it is added to your bill, paid at the desk when you check out.',
    );
    expect(dialog).not.toHaveTextContent('This is charged to your saved card now.');
    await act(async () => {
      await user.click(
        within(dialog).getByRole('button', { name: 'Ask for 1 Outdoor Walk ($15.00)' }),
      );
    });

    expect(screen.getByRole('status')).toHaveTextContent(REQUEST_SENT);
  });

  it('charges nothing and shows the new price when an add-on moved while the dialog was open', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue(catalogue);
    vi.mocked(requestAddOn).mockRejectedValueOnce(
      new ApiError('The price has changed since you checked it.', 409, {
        error: { code: 'ADD_ON_PRICE_CHANGED', details: [{ amount: 18 }] },
      }),
    );
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Add a walk or playtime' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a walk or playtime' });
    await within(dialog).findByRole('radio', { name: /Outdoor Walk/ });
    await act(async () => {
      await user.click(
        within(dialog).getByRole('button', { name: 'Ask for 1 Outdoor Walk ($15.00)' }),
      );
    });

    expect(requestAddOn).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      serviceId: 'svc-walk',
      date: '2026-12-13',
      quantity: 1,
      expectedAmount: 15,
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'The amount changed while this was open, so nothing was charged.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Ask for 1 Outdoor Walk ($18.00)' }),
    ).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('asks for a new check-out time only while the pet is in', async () => {
    vi.mocked(requestTimes).mockResolvedValue({
      ...sentRequest,
      details: { kind: 'times', pickUpTime: '14:00' },
      quotedAmount: null,
    });
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Change time' }));
    const dialog = screen.getByRole('dialog', { name: 'Change time' });
    expect(within(dialog).queryByLabelText('Check-in time')).not.toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Ask to change the time' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Check-out time'), {
      target: { value: '14:00' },
    });
    await act(async () => {
      await user.click(confirm);
    });

    expect(requestTimes).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      pickUpTime: '14:00',
    });
    expect(screen.getByRole('status')).toHaveTextContent(REQUEST_SENT);
  });

  it('opens the dialog a link names, then drops the parameters from the address', () => {
    renderStays([biscuit], '/parent/stays?open=extend&stay=bp-biscuit');

    expect(screen.getByRole('dialog', { name: 'Extend the stay' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('ignores a link to a dialog the stay does not allow', () => {
    renderStays([mochi], '/parent/stays?open=extend&stay=bp-mochi');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });
});
