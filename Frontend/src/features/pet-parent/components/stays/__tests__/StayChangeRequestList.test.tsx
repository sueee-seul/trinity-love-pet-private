import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStayChangeRequests, withdrawStayChangeRequest } from '../../../api/stayChangesApi';
import type { StayChangeRequest } from '../../../types/stayChanges';
import { StayChangeRequestList } from '../StayChangeRequestList';

vi.mock('../../../api/stayChangesApi', () => ({
  fetchStayChangeRequests: vi.fn(),
  withdrawStayChangeRequest: vi.fn(),
}));

const base: StayChangeRequest = {
  id: 'request-1',
  bookingId: 'booking-1',
  bookingPetId: null,
  details: { kind: 'extend', endDate: '2026-10-17' },
  quotedAmount: 55,
  status: 'pending',
  refusalReason: null,
  summary: "extend Max's stay to 17 Oct 2026 ($55.00)",
  createdAt: new Date().toISOString(),
  decidedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StayChangeRequestList', () => {
  it("shows each request with our manager's answer and the reason for a refusal", async () => {
    vi.mocked(fetchStayChangeRequests).mockResolvedValue([
      base,
      {
        ...base,
        id: 'request-2',
        details: {
          kind: 'add_on',
          serviceId: 'svc-walk',
          serviceName: 'Outdoor Walk',
          date: '2026-10-15',
          quantity: 1,
        },
        quotedAmount: 15,
        status: 'refused',
        refusalReason: 'We are fully booked on those dates.',
        decidedAt: new Date().toISOString(),
      },
    ]);
    render(<StayChangeRequestList refreshKey={0} />);

    expect(await screen.findByText('Extend to Sat 17 Oct ($55.00)')).toBeInTheDocument();
    expect(screen.getByText('Waiting for our manager')).toBeInTheDocument();
    expect(screen.getByText('1 Outdoor Walk on Thu 15 Oct ($15.00)')).toBeInTheDocument();
    expect(screen.getByText('Not approved')).toBeInTheDocument();
    expect(screen.getByText('Reason: We are fully booked on those dates.')).toBeInTheDocument();
  });

  it('withdraws a waiting request and reads the list again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStayChangeRequests)
      .mockResolvedValueOnce([base])
      .mockResolvedValue([{ ...base, status: 'cancelled', decidedAt: new Date().toISOString() }]);
    vi.mocked(withdrawStayChangeRequest).mockResolvedValue({ withdrawn: true });
    render(<StayChangeRequestList refreshKey={0} />);

    const withdraw = await screen.findByRole('button', { name: 'Withdraw request' });
    await act(async () => {
      await user.click(withdraw);
    });

    expect(withdrawStayChangeRequest).toHaveBeenCalledWith('request-1');
    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
  });

  it('shows nothing when there are no requests', async () => {
    vi.mocked(fetchStayChangeRequests).mockResolvedValue([]);
    const { container } = render(<StayChangeRequestList refreshKey={0} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
