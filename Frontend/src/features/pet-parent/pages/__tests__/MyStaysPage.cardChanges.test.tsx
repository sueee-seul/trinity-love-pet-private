import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDate } from '../../../../shared/components/ui/date/testing';
import { ApiError } from '../../api/bookingApi';
import {
  cancelStay,
  previewCancellation,
  previewReschedule,
  rescheduleStay,
} from '../../api/stayChangesApi';
import { bookedStay } from '../../components/stays/__tests__/stayFixtures';
import type { PetStay } from '../../types/stays';
import { MyStaysPage } from '../MyStaysPage';

vi.mock('../../api/stayChangesApi', () => ({
  previewCancellation: vi.fn(),
  cancelStay: vi.fn(),
  previewReschedule: vi.fn(),
  rescheduleStay: vi.fn(),
}));

/** 09:00 on Mon 30 Nov 2026 in Auckland, 12 days before check-in. */
const NOW = new Date('2026-11-29T20:00:00Z');

const renderStays = (stays: PetStay[]): ReturnType<typeof userEvent.setup> => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MyStaysPage stays={stays} />
    </MemoryRouter>,
  );
  return user;
};

const mochi = bookedStay({ bookingPetId: 'bp-mochi', pet: { id: 'pet-mochi', name: 'Mochi' } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('My Stays with a saved card', () => {
  it('says what the card is doing, and plainly when it is a test', () => {
    renderStays([
      bookedStay(),
      bookedStay({
        bookingPetId: 'bp-rex',
        bookingId: 'booking-2',
        pet: { id: 'pet-rex', name: 'Rex' },
        status: 'cancelled',
        reviewStatus: 'cancelled',
        card: {
          status: 'succeeded',
          amount: 180,
          capturedAmount: 90,
          testMode: false,
          paysAtRequest: true,
        },
      }),
    ]);

    expect(
      screen.getByText(/\$460\.00 is held on your card\. It is charged when you check in\./),
    ).toHaveTextContent('Test: no real money moves.');
    expect(screen.getByText('Cancelled. A late fee of $90.00 was charged.')).toBeInTheDocument();
    // Only the booked stay can be changed.
    expect(screen.getAllByRole('button', { name: 'Cancel stay' })).toHaveLength(1);
  });

  it('shows the exact cost before cancelling, then cancels every pet on the booking', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 230,
      rule: 'late',
      total: 460,
      contact: { email: 'bookings@wagstay.example', phone: '09 555 0100' },
    });
    vi.mocked(cancelStay).mockResolvedValue({ fee: 230 });
    const user = renderStays([bookedStay(), mochi]);

    await user.click(screen.getAllByRole('button', { name: 'Cancel stay' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: 'Cancel this stay?' });
    expect(dialog).toHaveTextContent(
      'This cancels the stay for Biscuit and Mochi, check-in Sat 12 Dec.',
    );
    expect(
      await within(dialog).findByText(
        'Cancelling now costs $230.00, one night for each confirmed pet. It is taken from your card, and the rest is released.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '09 555 0100' })).toHaveAttribute(
      'href',
      'tel:09 555 0100',
    );

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Cancel and pay $230.00' }));
    });

    expect(cancelStay).toHaveBeenCalledWith('booking-1', { expectedFee: 230 });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your stay is cancelled. A late fee of $230.00 was charged, and the rest of the hold released.',
    );
    expect(screen.queryByRole('dialog', { name: 'Cancel this stay?' })).not.toBeInTheDocument();
  });

  it('says a request no manager has approved yet is free to withdraw', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 0,
      rule: 'pending_request',
      total: 460,
      contact: { email: null, phone: null },
    });
    const user = renderStays([bookedStay()]);

    await user.click(screen.getByRole('button', { name: 'Cancel stay' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this stay?' });

    expect(
      await within(dialog).findByText(
        'Our manager hasn’t approved this request yet, so withdrawing it is free. Nothing is charged.',
      ),
    ).toBeInTheDocument();
  });

  it('checks new dates first, then moves the stay once', async () => {
    const preview = {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
      nights: 3,
      total: 460,
      usesFreeReschedule: true,
      holdAt: '2026-12-16T21:30:00.000Z',
      paysNow: false,
    };
    vi.mocked(previewReschedule).mockResolvedValue(preview);
    vi.mocked(rescheduleStay).mockResolvedValue({ ...preview, held: false });
    const user = renderStays([bookedStay()]);

    await user.click(screen.getByRole('button', { name: 'Change dates' }));
    const dialog = screen.getByRole('dialog', { name: 'Change the dates' });
    await chooseDate(
      user,
      within(dialog).getByRole('button', { name: /New check-in date/ }),
      '2026-12-19',
    );
    await chooseDate(
      user,
      within(dialog).getByRole('button', { name: /New check-out date/ }),
      '2026-12-22',
    );
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Check the new dates' }));
    });

    expect(previewReschedule).toHaveBeenCalledWith('booking-1', {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
    });
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Sat 19 Dec to Tue 22 Dec, 3 nights. New total: $460.00.',
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent('This uses your one free change.');

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Change dates' }));
    });
    expect(rescheduleStay).toHaveBeenCalledWith('booking-1', {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
      expectedTotal: 460,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your new dates start Sat 19 Dec and are waiting for manager approval. The new total is $460.00.',
    );
  });

  it('names the full nights when the new dates have no room', async () => {
    vi.mocked(previewReschedule).mockRejectedValue(
      new ApiError('Some of those nights are fully booked.', 409, {
        error: { code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-12-20' }] },
      }),
    );
    const user = renderStays([bookedStay()]);

    await user.click(screen.getByRole('button', { name: 'Change dates' }));
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Check the new dates' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sorry, Sun 20 Dec is fully booked. Please choose other dates.',
    );
    expect(rescheduleStay).not.toHaveBeenCalled();
  });

  it('stops offering a date change once the stay has none left', () => {
    renderStays([bookedStay({ dateChangesLeft: 0 })]);

    expect(screen.queryByRole('button', { name: 'Change dates' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel stay' })).toBeInTheDocument();
  });

  it('lets a request still waiting for review be withdrawn, with nothing held', () => {
    renderStays([
      bookedStay({
        status: 'waiting_for_review',
        reviewStatus: 'pending',
        card: {
          status: 'pending',
          amount: 460,
          capturedAmount: null,
          testMode: false,
          paysAtRequest: false,
        },
      }),
    ]);

    expect(
      screen.getByText(
        'Your card is saved. Nothing is held or charged while our manager reviews the request.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel stay' })).not.toBeInTheDocument();
  });

  it('hides every change once any pet on the booking has arrived at the desk', () => {
    renderStays([bookedStay(), { ...mochi, checkInOutcome: 'checked_in', status: 'staying_now' }]);

    // Biscuit's own card shows no outcome, but the booking is at the desk: the server would
    // refuse the change, so the buttons are not offered.
    expect(screen.queryByRole('button', { name: 'Cancel stay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change dates' })).not.toBeInTheDocument();
  });

  it('charges nothing and shows the new fee when it moved while the dialog was open', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 0,
      rule: 'early',
      total: 460,
      contact: { email: null, phone: null },
    });
    vi.mocked(cancelStay).mockRejectedValueOnce(
      new ApiError('The cancellation fee has changed since you checked it.', 409, {
        error: { code: 'CANCELLATION_FEE_CHANGED', details: [{ amount: 120 }] },
      }),
    );
    const user = renderStays([bookedStay()]);

    await user.click(screen.getByRole('button', { name: 'Cancel stay' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this stay?' });
    await within(dialog).findByText(/Cancelling now is free/);
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Cancel stay' }));
    });

    expect(cancelStay).toHaveBeenCalledWith('booking-1', { expectedFee: 0 });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'The fee changed while this was open, so nothing was charged.',
    );
    // The button now names the fee as it is, and the stay is still there.
    expect(within(dialog).getByRole('button', { name: 'Cancel and pay $120.00' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers the same changes from the booking details, then opens the dialog', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 0,
      rule: 'early',
      total: 460,
      contact: { email: null, phone: null },
    });
    const user = renderStays([bookedStay()]);

    await user.click(screen.getByRole('button', { name: 'Booking details' }));
    const details = screen.getByRole('dialog', { name: 'Booking details' });
    await user.click(within(details).getByRole('button', { name: 'Cancel stay' }));

    expect(screen.queryByRole('dialog', { name: 'Booking details' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Cancel this stay?' })).toBeInTheDocument();
  });
});
