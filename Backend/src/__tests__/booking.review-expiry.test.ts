import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withLockedBooking } from '../repositories/booking.check-in.repository.js';
import { insertManagerFlag } from '../repositories/booking.notification.repository.js';
import {
  findUnchargedDecidedRequests,
  findWaitingRequests,
} from '../repositories/booking.review-expiry.repository.js';
import { refuseBookingPet } from '../repositories/manager.booking.review.repository.js';
import { chargeWhenDecided } from '../services/booking.settlement.js';
import { sendBookingNoticeEmail } from '../services/booking.transaction-emails.js';
import { EXPIRED_REVIEW_REASON, runReviewExpiryPass } from '../services/booking.review-expiry.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { LOCKED_BOOKING_ID, lockedBooking, lockedPet } from './support/lockedBookingFixtures.js';

vi.mock('../config/database.js', () => ({ pool: {} }));
vi.mock('../repositories/booking.check-in.repository.js', () => ({ withLockedBooking: vi.fn() }));
vi.mock('../repositories/booking.notification.repository.js', () => ({
  insertManagerFlag: vi.fn(async () => undefined),
}));
vi.mock('../repositories/booking.review-expiry.repository.js', () => ({
  findWaitingRequests: vi.fn(async () => []),
  findUnchargedDecidedRequests: vi.fn(async () => []),
}));
vi.mock('../repositories/manager.booking.review.repository.js', () => ({
  refuseBookingPet: vi.fn(async () => true),
}));
vi.mock('../services/booking.settlement.js', () => ({
  chargeWhenDecided: vi.fn(async () => 'charged'),
}));
vi.mock('../services/booking.transaction-emails.js', () => ({
  sendBookingNoticeEmail: vi.fn(async () => undefined),
}));

const NOW = new Date('2026-10-02T03:00:00.000Z');
const cards = new FakeCardProcessor();
const client = {};

const context = { cardProcessor: cards, now: NOW, log: vi.fn() };

/** Max was confirmed at checkout; Bella still waits for our manager. */
const mixedRequest = lockedBooking({
  paysAtRequest: true,
  pets: [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'pending' })],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) =>
    work(mixedRequest, client as never),
  );
});

describe('runReviewExpiryPass', () => {
  it('refuses the pets still waiting at the deadline and settles the booking', async () => {
    vi.mocked(findWaitingRequests).mockResolvedValue([
      {
        bookingId: LOCKED_BOOKING_ID,
        deadline: new Date(NOW.getTime() - 60_000),
        petNames: ['Bella'],
      },
    ]);
    vi.mocked(refuseBookingPet).mockImplementation(async (_id, _reviewer, _reason, compose) => {
      compose({
        bookingId: LOCKED_BOOKING_ID,
        ownerId: 'owner-1',
        subject: { petNames: ['Bella'], dropOffTime: null, pickUpTime: null },
        previousStatus: 'pending',
        previousRefusalReason: null,
      });
      return true;
    });

    const summary = await runReviewExpiryPass(context);

    // No manager decided, so no reviewer is recorded.
    expect(refuseBookingPet).toHaveBeenCalledWith(
      'pet-b',
      null,
      EXPIRED_REVIEW_REASON,
      expect.any(Function),
      client,
    );
    expect(chargeWhenDecided).toHaveBeenCalledWith(
      mixedRequest,
      [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b', reviewStatus: 'refused' })],
      client,
      cards,
    );
    expect(sendBookingNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_refused', ownerId: 'owner-1' }),
    );
    expect(summary).toMatchObject({ expired: 1, dueSoon: 0 });
  });

  it('flags every manager once when a deadline is less than 4 hours away', async () => {
    vi.mocked(findWaitingRequests).mockResolvedValue([
      {
        bookingId: LOCKED_BOOKING_ID,
        deadline: new Date('2026-10-02T05:00:00.000Z'),
        petNames: ['Bella', 'Max'],
      },
    ]);

    const summary = await runReviewExpiryPass(context);

    expect(insertManagerFlag).toHaveBeenCalledWith(
      {},
      {
        bookingId: LOCKED_BOOKING_ID,
        setting: 'booking_review_due',
        summary:
          'Decision due by 18:00 Fri 2 Oct: Bella, Max (PB-1A2B3C). After that the request is released and nothing is charged for it.',
      },
    );
    expect(refuseBookingPet).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dueSoon: 1, expired: 0 });
  });

  it('charges a decided request whose hold was never charged', async () => {
    vi.mocked(findUnchargedDecidedRequests).mockResolvedValue([LOCKED_BOOKING_ID]);

    const summary = await runReviewExpiryPass(context);

    expect(chargeWhenDecided).toHaveBeenCalledWith(mixedRequest, mixedRequest.pets, client, cards);
    expect(summary.charged).toBe(1);
  });

  it('leaves a booking for the next run when the processor cannot be reached', async () => {
    vi.mocked(findWaitingRequests).mockResolvedValue([
      { bookingId: LOCKED_BOOKING_ID, deadline: NOW, petNames: ['Bella'] },
    ]);
    vi.mocked(chargeWhenDecided).mockRejectedValueOnce(new Error('processor down'));

    const summary = await runReviewExpiryPass(context);

    expect(summary).toMatchObject({ expired: 0, retryLater: 1 });
    expect(sendBookingNoticeEmail).not.toHaveBeenCalled();
  });
});
