import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDate } from '../../../../shared/components/ui/date/testing';
import {
  BookingApiError,
  cancelWithoutFeeOnServer,
  fetchManagerBookings,
  finishCheckInOnServer,
  recordArrivalOnServer,
  rescheduleWithoutChargeOnServer,
} from '../../api/bookingApi';
import { cardBookingPet, cardBookingSecondPet } from '../../__tests__/bookingFixtures';
import { useBookingStore } from '../../store/bookingStore';
import { AdminBookingsPage } from '../AdminBookingsPage';

vi.mock('../../api/bookingApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/bookingApi')>()),
  fetchManagerBookings: vi.fn(),
  approveBookingOnServer: vi.fn(),
  refuseBookingOnServer: vi.fn(),
  undoBookingReviewOnServer: vi.fn(),
  recordArrivalOnServer: vi.fn(async () => undefined),
  finishCheckInOnServer: vi.fn(),
  cancelWithoutFeeOnServer: vi.fn(async () => undefined),
  rescheduleWithoutChargeOnServer: vi.fn(async () => ({
    startDate: '2026-12-19',
    endDate: '2026-12-22',
    nights: 3,
    total: 460,
  })),
}));

/** 09:00 on Sat 12 Dec 2026 in Auckland: the drop-off day. */
const DROP_OFF_MORNING = new Date('2026-12-11T20:00:00Z');

const renderPage = async (now: Date): Promise<ReturnType<typeof userEvent.setup>> => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <AdminBookingsPage />
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: /^Confirmed/ });
  return user;
};

beforeEach(() => {
  vi.clearAllMocks();
  useBookingStore.setState({
    bookingByUuid: {},
    bookingUuids: [],
    snapshotStatus: 'idle',
    snapshotError: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the bookings desk', () => {
  it('records each pet, then charges once for what the arrivals cost', async () => {
    vi.mocked(fetchManagerBookings)
      .mockResolvedValueOnce([cardBookingPet(), cardBookingSecondPet()])
      .mockResolvedValueOnce([
        cardBookingPet({
          booking: {
            check_in_outcome: 'checked_in',
            card_guarantee: {
              status: 'succeeded',
              amount: 460,
              captured_amount: 290,
              test_mode: true,
              pays_at_request: false,
            },
          },
        }),
        cardBookingSecondPet({
          check_in_outcome: 'no_show',
          card_guarantee: {
            status: 'succeeded',
            amount: 460,
            captured_amount: 290,
            test_mode: true,
            pays_at_request: false,
          },
        }),
      ]);
    vi.mocked(finishCheckInOnServer).mockResolvedValue({ result: 'charged', amount: 290 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await renderPage(DROP_OFF_MORNING);

    await user.click(screen.getByRole('button', { name: /^Confirmed/ }));
    expect(screen.getAllByText('Card held: $460.00. Charged at check-in.')).toHaveLength(2);
    expect(screen.getAllByText('TEST: no real money')).toHaveLength(2);
    expect(
      screen.getByText('Record every pet on this booking, then finish check-in.'),
    ).toBeInTheDocument();

    const biscuit = screen.getByRole('group', { name: 'Arrival of Biscuit' });
    await user.click(within(biscuit).getByRole('button', { name: 'Checked in' }));
    expect(recordArrivalOnServer).toHaveBeenCalledWith('bp-biscuit', 'checked_in');
    expect(within(biscuit).getByRole('button', { name: 'Checked in' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const mochi = screen.getByRole('group', { name: 'Arrival of Mochi' });
    await user.click(within(mochi).getByRole('button', { name: 'No-show' }));

    await user.click(screen.getByRole('button', { name: 'Finish check-in: charge $290.00' }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Charge $290.00 to the guest's card and release the rest of the hold?",
    );
    expect(finishCheckInOnServer).toHaveBeenCalledWith('booking-1');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Charged $290.00. The rest of the hold was released.',
    );
    expect(screen.getAllByText('Charged $290.00 for the booking.')).toHaveLength(2);
    expect(screen.getByText('Arrival: Checked in')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Arrival of Biscuit' })).not.toBeInTheDocument();
  });

  it("shows the server's reason when it refuses", async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([
      cardBookingPet({ booking: { check_in_outcome: 'checked_in' } }),
    ]);
    vi.mocked(finishCheckInOnServer).mockRejectedValue(
      new BookingApiError('Card payments are not set up on this server.', 503),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await renderPage(DROP_OFF_MORNING);

    await user.click(screen.getByRole('button', { name: /^Confirmed/ }));
    await user.click(screen.getByRole('button', { name: 'Finish check-in: charge $230.00' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Card payments are not set up on this server.',
    );
  });

  it('lets staff see new requests and work the desk, with every decision left to a manager', async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([
      cardBookingPet({
        booking_pets_uuid: 'bp-new',
        booking_id: 'booking-new',
        pet: { id: 'pet-luna', name: 'Luna', type: 'cat' },
        booking: { manager_review_status: 'pending' },
      }),
      cardBookingPet(),
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DROP_OFF_MORNING);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminBookingsPage staffDesk />
      </MemoryRouter>,
    );

    // A new request waits on the first tab, with nothing for staff to decide.
    expect(await screen.findByText('Luna')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You can record arrivals and finish check-in. Only a manager can approve or refuse a stay, turn a pet away, or cancel or move a stay without a fee.',
      ),
    ).toBeInTheDocument();
    const request = screen.getByRole('heading', { name: /Luna/ }).closest('.rounded-xl');
    expect(request).not.toBeNull();
    expect(within(request as HTMLElement).queryByRole('button')).not.toBeInTheDocument();

    // An approved stay on its drop-off day: staff record the arrival and finish check-in.
    await user.click(screen.getByRole('button', { name: /^Confirmed/ }));
    const arrival = await screen.findByRole('group', { name: 'Arrival of Biscuit' });
    expect(within(arrival).getByRole('button', { name: 'Checked in' })).toBeEnabled();
    expect(within(arrival).getByRole('button', { name: 'No-show' })).toBeEnabled();
    expect(
      within(arrival).queryByRole('button', { name: "We can't take this pet" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /without a fee/i })).not.toBeInTheDocument();

    await act(async () => {
      await user.click(within(arrival).getByRole('button', { name: 'Checked in' }));
    });
    expect(recordArrivalOnServer).toHaveBeenCalledWith('bp-biscuit', 'checked_in');
  });

  it('lists arrivals nobody recorded and card holds that failed', async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([
      cardBookingPet(),
      cardBookingPet({
        booking_pets_uuid: 'bp-rex',
        booking_id: 'booking-2',
        customer: {
          id: 'owner-2',
          name: 'Sam Lee',
          contact: { email: 'sam@example.test', phone: null },
        },
        pet: { id: 'pet-rex', name: 'Rex', type: 'dog' },
        booking: {
          drop_off_at: '2026-12-20T21:00:00Z',
          card_guarantee: {
            status: 'failed',
            amount: 180,
            captured_amount: null,
            test_mode: false,
            pays_at_request: false,
          },
        },
      }),
    ]);
    // 09:00 on Mon 14 Dec in Auckland.
    await renderPage(new Date('2026-12-13T20:00:00Z'));

    const unrecorded = screen.getByRole('region', { name: 'Arrivals to record (1)' });
    expect(unrecorded).toHaveTextContent('Biscuit (Ava Mitchell), drop-off Sat 12 Dec');
    const failed = screen.getByRole('region', { name: 'Card holds that failed (1)' });
    expect(failed).toHaveTextContent('Sam Lee: Rex, drop-off Mon 21 Dec');
  });

  it('cancels a whole booking without a fee, with the reason', async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([cardBookingPet(), cardBookingSecondPet()]);
    // Before the drop-off day, so the desk is not open yet.
    const user = await renderPage(new Date('2026-12-01T20:00:00Z'));
    await user.click(screen.getByRole('button', { name: /^Confirmed/ }));

    // Booking-wide, so it is offered once, not on every pet's card.
    expect(screen.getAllByRole('button', { name: 'Cancel without a fee' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancel without a fee' }));
    const confirm = screen.getByRole('button', { name: 'Cancel booking, no fee' });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText('Why is this booking cancelled without a fee?'),
      'MetService red warning',
    );
    await act(async () => {
      await user.click(confirm);
    });

    expect(cancelWithoutFeeOnServer).toHaveBeenCalledWith('booking-1', 'MetService red warning');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Booking cancelled without a fee. The card hold was released.',
    );
  });

  it('moves a whole stay without a charge, with the reason', async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([cardBookingPet(), cardBookingSecondPet()]);
    const user = await renderPage(new Date('2026-12-01T20:00:00Z'));
    await user.click(screen.getByRole('button', { name: /^Confirmed/ }));

    await user.click(screen.getByRole('button', { name: 'Move without a charge' }));
    await chooseDate(user, screen.getByRole('button', { name: /New drop-off date/ }), '2026-12-19');
    await chooseDate(user, screen.getByRole('button', { name: /New pick-up date/ }), '2026-12-22');
    const move = screen.getByRole('button', { name: 'Move stay' });
    expect(move).toBeDisabled();
    await user.type(
      screen.getByLabelText('Why is this stay moved without a charge?'),
      'Civil defence emergency',
    );
    await act(async () => {
      await user.click(move);
    });

    expect(rescheduleWithoutChargeOnServer).toHaveBeenCalledWith('booking-1', {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
      reason: 'Civil defence emergency',
    });
    expect(
      await screen.findByText(
        'Stay moved to Sat 19 Dec without a charge. The guest keeps their free change.',
      ),
    ).toHaveAttribute('role', 'status');
  });
});
