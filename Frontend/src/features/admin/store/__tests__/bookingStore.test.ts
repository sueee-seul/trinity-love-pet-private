import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveBookingOnServer,
  fetchManagerBookings,
  refuseBookingOnServer,
} from '../../api/bookingApi';
import { cardBookingPet } from '../../__tests__/bookingFixtures';
import { useBookingStore } from '../bookingStore';

vi.mock('../../api/bookingApi', () => ({
  approveBookingOnServer: vi.fn(async () => undefined),
  refuseBookingOnServer: vi.fn(async () => undefined),
  undoBookingReviewOnServer: vi.fn(async () => undefined),
  fetchManagerBookings: vi.fn(),
  recordArrivalOnServer: vi.fn(),
  finishCheckInOnServer: vi.fn(),
  cancelWithoutFeeOnServer: vi.fn(),
  rescheduleWithoutChargeOnServer: vi.fn(),
}));

const waiting = cardBookingPet({ booking: { manager_review_status: 'pending' } });
const ID = waiting.booking_pets_uuid;

/** What the server answers after the decision: charged, and the manager's display name. */
const decided = cardBookingPet({
  booking: {
    manager_review_status: 'approved',
    reviewer_name: 'Mere Walker',
    card_guarantee: {
      status: 'succeeded',
      amount: 460,
      captured_amount: null,
      test_mode: true,
      pays_at_request: true,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  useBookingStore.setState({
    bookingByUuid: { [ID]: waiting },
    bookingUuids: [ID],
    snapshotStatus: 'ready',
    snapshotError: null,
  });
});

describe('booking decisions read the list again', () => {
  it('shows the charge and the manager name the server recorded after approving', async () => {
    vi.mocked(fetchManagerBookings).mockResolvedValue([decided]);

    await useBookingStore.getState().approveBooking(ID);

    expect(approveBookingOnServer).toHaveBeenCalledWith(ID);
    expect(useBookingStore.getState().bookingByUuid[ID]?.booking).toMatchObject({
      reviewer_name: 'Mere Walker',
      card_guarantee: { status: 'succeeded' },
    });
  });

  it('keeps the local decision when the list cannot be read again', async () => {
    vi.mocked(fetchManagerBookings).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await useBookingStore.getState().refuseBooking(ID, 'Full that week');

    expect(refuseBookingOnServer).toHaveBeenCalledWith(ID, 'Full that week');
    expect(useBookingStore.getState().bookingByUuid[ID]?.booking).toMatchObject({
      manager_review_status: 'refused',
      refusal_reason: 'Full that week',
    });
  });
});
