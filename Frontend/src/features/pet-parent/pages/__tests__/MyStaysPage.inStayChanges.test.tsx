import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDate } from '../../../../shared/components/ui/date/testing';
import { ApiError } from '../../api/bookingApi';
import {
  bookAddOn,
  changeStayTimes,
  extendStay,
  fetchAddOnCatalogue,
  previewExtension,
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
  extendStay: vi.fn(),
  fetchAddOnCatalogue: vi.fn(),
  bookAddOn: vi.fn(),
  changeStayTimes: vi.fn(),
}));

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

  it('prices the added nights first, then extends at that price and says what was charged', async () => {
    vi.mocked(previewExtension).mockResolvedValue(extension);
    vi.mocked(extendStay).mockResolvedValue({ ...extension, chargeId: 'charge-1' });
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
      await user.click(within(dialog).getByRole('button', { name: 'Extend and pay $86.00' }));
    });

    expect(extendStay).toHaveBeenCalledWith('booking-1', {
      endDate: '2026-12-19',
      expectedAmount: 86,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Extended to Sat 19 Dec. $86.00 was charged to your saved card.',
    );
    expect(screen.queryByRole('dialog', { name: 'Extend the stay' })).not.toBeInTheDocument();
  });

  it('extends a booking without a saved card and puts the nights on the bill for check-out', async () => {
    const toBill = { ...extension, settlement: 'desk' as const };
    vi.mocked(previewExtension).mockResolvedValue(toBill);
    vi.mocked(extendStay).mockResolvedValue({ ...toBill, chargeId: 'charge-9' });
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Extend the stay' }));
    const dialog = screen.getByRole('dialog', { name: 'Extend the stay' });
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Check the price' }));
    });

    const summary = within(dialog).getByRole('status');
    expect(summary).toHaveTextContent('The added nights cost $86.00.');
    expect(summary).toHaveTextContent(
      'This will be added to your bill. You pay it at the desk when you check out.',
    );
    expect(summary).not.toHaveTextContent('charged to your saved card');
    await act(async () => {
      await user.click(
        within(dialog).getByRole('button', { name: 'Extend and add $86.00 to my bill' }),
      );
    });

    expect(extendStay).toHaveBeenCalledWith('booking-1', {
      endDate: '2026-12-16',
      expectedAmount: 86,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Extended to Sat 19 Dec. $86.00 was added to your bill. You pay it at the desk when you check out.',
    );
  });

  it('loads the add-ons, names the service and total on the button, and books at that price', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue(catalogue);
    vi.mocked(bookAddOn).mockResolvedValue({
      chargeId: 'charge-2',
      bookingPetId: 'bp-biscuit',
      petName: 'Biscuit',
      serviceName: 'Outdoor Walk',
      date: '2026-12-14',
      quantity: 2,
      amount: 30,
      taskId: null,
      settlement: 'card',
    });
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Add a walk or playtime' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a walk or playtime' });
    expect(
      await within(dialog).findByRole('radio', { name: /Outdoor Walk, \$15\.00 per day/ }),
    ).toBeChecked();
    expect(fetchAddOnCatalogue).toHaveBeenCalledWith('booking-1');

    await user.selectOptions(within(dialog).getByLabelText('Day'), '2026-12-14');
    await user.selectOptions(within(dialog).getByLabelText('How many'), '2');
    const confirm = within(dialog).getByRole('button', { name: 'Add 2 Outdoor Walk for $30.00' });
    expect(dialog).toHaveTextContent('This is charged to your saved card now.');

    // A service priced for the stay is not counted.
    await user.click(within(dialog).getByRole('radio', { name: /Bath, \$40\.00 per stay/ }));
    expect(within(dialog).queryByLabelText('How many')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add 1 Bath for $40.00' })).toBeEnabled();
    await user.click(within(dialog).getByRole('radio', { name: /Outdoor Walk, \$15\.00 per day/ }));
    expect(dialog).toHaveTextContent('A 30 minute walk.');
    await user.selectOptions(within(dialog).getByLabelText('How many'), '2');

    await act(async () => {
      await user.click(confirm);
    });

    expect(bookAddOn).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      serviceId: 'svc-walk',
      date: '2026-12-14',
      quantity: 2,
      expectedAmount: 30,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Added 2 Outdoor Walk on Mon 14 Dec. $30.00 was charged to your saved card.',
    );
  });

  it('books an add-on without a saved card and says it is paid at the desk at check-out', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue({ ...catalogue, settlement: 'desk' });
    vi.mocked(bookAddOn).mockResolvedValue({
      chargeId: 'charge-3',
      bookingPetId: 'bp-biscuit',
      petName: 'Biscuit',
      serviceName: 'Outdoor Walk',
      date: '2026-12-13',
      quantity: 1,
      amount: 15,
      taskId: null,
      settlement: 'desk',
    });
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Add a walk or playtime' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a walk or playtime' });
    await within(dialog).findByRole('radio', { name: /Outdoor Walk/ });
    expect(dialog).toHaveTextContent(
      'This will be added to your bill. You pay it at the desk when you check out.',
    );
    expect(dialog).not.toHaveTextContent('This is charged to your saved card now.');
    await act(async () => {
      await user.click(
        within(dialog).getByRole('button', { name: 'Add 1 Outdoor Walk for $15.00' }),
      );
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Added 1 Outdoor Walk on Sun 13 Dec. $15.00 was added to your bill. You pay it at the desk when you check out.',
    );
  });

  it('charges nothing and shows the new price when an add-on moved while the dialog was open', async () => {
    vi.mocked(fetchAddOnCatalogue).mockResolvedValue(catalogue);
    vi.mocked(bookAddOn).mockRejectedValueOnce(
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
        within(dialog).getByRole('button', { name: 'Add 1 Outdoor Walk for $15.00' }),
      );
    });

    expect(bookAddOn).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      serviceId: 'svc-walk',
      date: '2026-12-13',
      quantity: 1,
      expectedAmount: 15,
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'The amount changed while this was open, so nothing was charged.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Add 1 Outdoor Walk for $18.00' }),
    ).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('moves the check-out time only while the pet is in, and says the new times', async () => {
    vi.mocked(changeStayTimes).mockResolvedValue({
      dropOffAt: biscuit.dropOffAt,
      pickUpAt: '2026-12-15T01:00:00.000Z',
    });
    const user = renderStays([biscuit]);

    await user.click(screen.getByRole('button', { name: 'Change time' }));
    const dialog = screen.getByRole('dialog', { name: 'Change time' });
    expect(within(dialog).queryByLabelText('Check-in time')).not.toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Change time' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Check-out time'), {
      target: { value: '14:00' },
    });
    await act(async () => {
      await user.click(confirm);
    });

    expect(changeStayTimes).toHaveBeenCalledWith('booking-1', 'bp-biscuit', {
      pickUpTime: '14:00',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Times changed. Check-in Sat 12 Dec 10:30, check-out Tue 15 Dec 14:00. Nothing was charged.',
    );
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
