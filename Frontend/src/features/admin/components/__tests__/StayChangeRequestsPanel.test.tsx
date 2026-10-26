import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveStayChangeRequest,
  fetchStayChangeRequests,
  refuseStayChangeRequest,
} from '../../api/bookingApi';
import { StayChangeRequestsPanel } from '../booking/StayChangeRequestsPanel';
import type { ManagerStayChangeRequest } from '../../types/booking';

vi.mock('../../api/bookingApi', () => ({
  fetchStayChangeRequests: vi.fn(),
  approveStayChangeRequest: vi.fn(),
  refuseStayChangeRequest: vi.fn(),
}));

const extendMax: ManagerStayChangeRequest = {
  id: 'request-1',
  bookingId: 'booking-1',
  bookingPetId: null,
  details: { kind: 'extend', endDate: '2026-10-17' },
  quotedAmount: 55,
  status: 'pending',
  refusalReason: null,
  summary: "extend Max's stay to 17 Oct 2026 ($55.00)",
  createdAt: '2026-10-14T01:00:00.000Z',
  decidedAt: null,
  reference: 'PB-AAAAAA',
  ownerName: 'Olivia Brown',
  petNames: ['Max'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StayChangeRequestsPanel', () => {
  it('lists what the parent asks for and approves it, then refreshes the bookings', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    vi.mocked(fetchStayChangeRequests).mockResolvedValueOnce([extendMax]).mockResolvedValue([]);
    vi.mocked(approveStayChangeRequest).mockResolvedValue(undefined);
    render(<StayChangeRequestsPanel canDecide onDecided={onDecided} />);

    const panel = await screen.findByRole('region', { name: /Change requests/ });
    expect(panel).toHaveTextContent(
      "The parent asks to extend Max's stay to 17 Oct 2026 ($55.00).",
    );
    expect(panel).toHaveTextContent('PB-AAAAAA · Olivia Brown');

    await act(async () => {
      await user.click(within(panel).getByRole('button', { name: 'Approve' }));
    });

    expect(approveStayChangeRequest).toHaveBeenCalledWith('request-1');
    expect(onDecided).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Approved.');
  });

  it('refuses with a reason the parent reads, and says why an approval failed', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStayChangeRequests).mockResolvedValue([extendMax]);
    vi.mocked(approveStayChangeRequest).mockRejectedValueOnce(
      new Error('Sorry, those nights are fully booked.'),
    );
    vi.mocked(refuseStayChangeRequest).mockResolvedValue(undefined);
    render(<StayChangeRequestsPanel canDecide onDecided={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /Change requests/ });

    await act(async () => {
      await user.click(within(panel).getByRole('button', { name: 'Approve' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Sorry, those nights are fully booked.');

    await user.click(within(panel).getByRole('button', { name: 'Refuse' }));
    await user.click(within(panel).getByLabelText('We are fully booked on those dates.'));
    await act(async () => {
      await user.click(within(panel).getByRole('button', { name: 'Confirm refuse' }));
    });
    expect(refuseStayChangeRequest).toHaveBeenCalledWith(
      'request-1',
      'We are fully booked on those dates.',
    );
  });

  it('shows staff the requests without the buttons only a manager may use', async () => {
    vi.mocked(fetchStayChangeRequests).mockResolvedValue([extendMax]);
    render(<StayChangeRequestsPanel canDecide={false} onDecided={vi.fn()} />);

    const panel = await screen.findByRole('region', { name: /Change requests/ });
    expect(within(panel).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
