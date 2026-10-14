import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelActivePets,
  settlePayment,
  withLockedBooking,
  type LockedBooking,
} from '../repositories/booking.check-in.repository.js';
import { cancelByGuest, previewCancellation } from '../services/booking.guest-change.js';
import { notifyCancelledByParent } from '../services/booking.in-stay.notifications.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import { deleteTasksForBookingPet } from '../services/task.fromBooking.service.js';
import {
  chargedBooking,
  DROP_OFF_AT,
  guaranteePayment,
  LOCKED_BOOKING_ID,
  lockedBooking,
  lockedPet,
  OWNER_ID,
} from './support/lockedBookingFixtures.js';

vi.mock('../services/booking.in-stay.notifications.js', () => ({
  notifyCancelledByParent: vi.fn(async () => undefined),
}));

vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  withLockedBooking: vi.fn(),
  settlePayment: vi.fn(),
  cancelActivePets: vi.fn(async () => ['pet-a', 'pet-b']),
}));

vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(),
  deleteTasksForBookingPet: vi.fn(async () => undefined),
}));

vi.mock('../services/concierge/concierge.status.js', () => ({
  readTeamContact: (): { email: string; phone: string } => ({
    email: 'bookings@wagstay.example',
    phone: '09 555 0100',
  }),
}));

const client = {} as PoolClient;
const HOURS = 3_600_000;
const hoursBeforeDropOff = (hours: number): Date => new Date(DROP_OFF_AT.getTime() - hours * HOURS);

const lock = (booking: LockedBooking): void => {
  vi.mocked(withLockedBooking).mockImplementation(async (_id, work) => work(booking, client));
};

const processor = (): CardProcessor => ({
  name: 'stripe',
  publishableKey: 'pk_test_example',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn(),
  captureHold: vi.fn<CardProcessor['captureHold']>(async () => undefined),
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
  refund: vi.fn<CardProcessor['refund']>(async () => undefined),
  chargeNow: vi.fn<CardProcessor['chargeNow']>(async () => ({
    status: 'succeeded',
    paymentIntentId: 'pi_fee',
  })),
});

let cards: CardProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  cards = processor();
});

describe('what cancelling costs', () => {
  it('is free 72 hours or more before drop-off, and says who to call for an emergency', async () => {
    lock(lockedBooking());

    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(100) }),
    ).resolves.toEqual({
      fee: 0,
      rule: 'early',
      total: 460,
      contact: { email: 'bookings@wagstay.example', phone: '09 555 0100' },
    });
  });

  it('is free within 24 hours of a booking made 72 hours or more ahead', async () => {
    lock(lockedBooking({ pets: [lockedPet({ approvedAt: hoursBeforeDropOff(80) })] }));

    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(70) }),
    ).resolves.toMatchObject({ fee: 0, rule: 'cooling_off' });
  });

  it('costs one night per approved pet later than that', async () => {
    lock(lockedBooking());

    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(30) }),
    ).resolves.toMatchObject({ fee: 120, rule: 'late' });
  });

  it('names the half-stay tier inside 72 hours, so the guest reads why it costs more', async () => {
    lock(lockedBooking({ paysAtRequest: true, termsVersion: 'concierge-terms-2026-10-06' }));

    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(30) }),
    ).resolves.toMatchObject({ fee: 230, rule: 'short_notice' });
    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(100) }),
    ).resolves.toMatchObject({ fee: 120, rule: 'late' });
  });

  it.each([
    ['another owner', lockedBooking({ ownerId: 'someone-else' }), 404, 'NOT_FOUND'],
    ['a stay that has started', lockedBooking(), 409, 'BOOKING_STARTED'],
    [
      'a pet already at the desk',
      lockedBooking({ pets: [lockedPet({ outcome: 'checked_in' })] }),
      409,
      'BOOKING_STARTED',
    ],
    [
      'a settled booking',
      lockedBooking({ payment: guaranteePayment({ status: 'canceled', capturedAmount: 0 }) }),
      409,
      'BOOKING_SETTLED',
    ],
  ])('is not offered for %s', async (label, booking, statusCode, code) => {
    lock(booking);
    const now =
      label === 'a stay that has started' ? hoursBeforeDropOff(-1) : hoursBeforeDropOff(30);

    await expect(previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now })).rejects.toMatchObject({
      statusCode,
      code,
    });
  });
});

describe('cancelling', () => {
  it('charges nothing when the fee moved since the guest saw it, and says what it is now', async () => {
    lock(lockedBooking());

    // The dialog showed a free cancellation; the 72-hour tier passed while it was open.
    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { expectedFee: 0 },
        { now: hoursBeforeDropOff(30), cardProcessor: cards },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CANCELLATION_FEE_CHANGED',
      details: [{ amount: 120 }],
    });

    expect(cards.captureHold).not.toHaveBeenCalled();
    expect(cancelActivePets).not.toHaveBeenCalled();
  });

  it('cancels at the previewed fee when it still holds, to the cent', async () => {
    lock(lockedBooking());

    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        { expectedFee: 120.004 },
        { now: hoursBeforeDropOff(30), cardProcessor: cards },
      ),
    ).resolves.toEqual({ fee: 120 });
  });

  it('releases the hold in full when it is free, and cancels every pet', async () => {
    lock(lockedBooking());

    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        {},
        {
          now: hoursBeforeDropOff(100),
          cardProcessor: cards,
        },
      ),
    ).resolves.toEqual({ fee: 0 });

    expect(cards.releaseHold).toHaveBeenCalledWith('pi_held');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'canceled',
      capturedAmount: 0,
    });
    expect(cancelActivePets).toHaveBeenCalledWith(
      client,
      LOCKED_BOOKING_ID,
      'Cancelled by the guest',
    );
    expect(deleteTasksForBookingPet).toHaveBeenCalledTimes(2);
    expect(notifyCancelledByParent).toHaveBeenCalledWith(LOCKED_BOOKING_ID, 0);
  });

  it('takes the late fee from the hold and lets the rest go', async () => {
    lock(lockedBooking());

    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        {},
        {
          now: hoursBeforeDropOff(30),
          cardProcessor: cards,
        },
      ),
    ).resolves.toEqual({ fee: 120 });

    expect(cards.captureHold).toHaveBeenCalledWith(
      'pi_held',
      120,
      `cancel-fee-${LOCKED_BOOKING_ID}`,
    );
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 120,
    });
  });

  it('charges the late fee to the saved card when no hold is placed yet', async () => {
    lock(
      lockedBooking({ payment: guaranteePayment({ status: 'pending', paymentIntentId: null }) }),
    );

    await cancelByGuest(
      OWNER_ID,
      LOCKED_BOOKING_ID,
      {},
      {
        now: hoursBeforeDropOff(60),
        cardProcessor: cards,
      },
    );

    expect(cards.chargeNow).toHaveBeenCalledWith({
      paymentMethodId: 'pm_saved',
      amount: 120,
      reference: 'PB-1A2B3C',
      idempotencyKey: `cancel-fee-${LOCKED_BOOKING_ID}`,
    });
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 120,
      paymentIntentId: 'pi_fee',
    });
  });

  it('is not capped by an earlier hold that was released', async () => {
    lock(
      lockedBooking({
        payment: guaranteePayment({
          status: 'pending',
          paymentIntentId: 'pi_released',
          amount: 40,
        }),
      }),
    );

    await cancelByGuest(
      OWNER_ID,
      LOCKED_BOOKING_ID,
      {},
      {
        now: hoursBeforeDropOff(60),
        cardProcessor: cards,
      },
    );

    expect(cards.chargeNow).toHaveBeenCalledWith(expect.objectContaining({ amount: 120 }));
  });

  it('cancels nothing when that card is declined', async () => {
    vi.mocked(cards.chargeNow).mockResolvedValue({
      status: 'failed',
      paymentIntentId: null,
      reason: 'declined',
    });
    lock(
      lockedBooking({ payment: guaranteePayment({ status: 'pending', paymentIntentId: null }) }),
    );

    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        {},
        {
          now: hoursBeforeDropOff(60),
          cardProcessor: cards,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 402, code: 'CARD_DECLINED' });
    expect(cancelActivePets).not.toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });
});

describe('fees follow each approved pet', () => {
  it('excludes pending and recently approved pets from a mixed request fee', async () => {
    lock(
      lockedBooking({
        pets: [
          lockedPet({ bookingPetsUuid: 'old', nightlyRate: 60 }),
          lockedPet({ bookingPetsUuid: 'recent', approvedAt: hoursBeforeDropOff(31) }),
          lockedPet({ bookingPetsUuid: 'waiting', reviewStatus: 'pending', approvedAt: null }),
        ],
      }),
    );
    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(30) }),
    ).resolves.toMatchObject({ fee: 60, rule: 'late' });
  });
  it('tells the guest a request no manager has approved yet is free to withdraw', async () => {
    lock(
      lockedBooking({
        payment: guaranteePayment({ status: 'pending', paymentIntentId: null }),
        pets: [lockedPet({ reviewStatus: 'pending', approvedAt: null })],
      }),
    );
    await expect(
      previewCancellation(OWNER_ID, LOCKED_BOOKING_ID, { now: hoursBeforeDropOff(1) }),
    ).resolves.toMatchObject({ fee: 0, rule: 'pending_request' });
  });
  it('withdraws an unapproved request without touching the card processor', async () => {
    lock(
      lockedBooking({
        payment: guaranteePayment({ status: 'pending', paymentIntentId: null }),
        pets: [lockedPet({ reviewStatus: 'pending', approvedAt: null })],
      }),
    );
    await expect(
      cancelByGuest(
        OWNER_ID,
        LOCKED_BOOKING_ID,
        {},
        {
          now: hoursBeforeDropOff(1),
          cardProcessor: cards,
        },
      ),
    ).resolves.toEqual({ fee: 0 });
    expect(cards.chargeNow).not.toHaveBeenCalled();
    expect(cards.captureHold).not.toHaveBeenCalled();
  });
});

describe('cancelling a stay paid at request', () => {
  const cancelAt = (hours: number): Promise<{ fee: number }> =>
    cancelByGuest(
      OWNER_ID,
      LOCKED_BOOKING_ID,
      {},
      {
        now: hoursBeforeDropOff(hours),
        cardProcessor: cards,
      },
    );

  it('refunds everything 7 days or more before drop-off', async () => {
    lock(chargedBooking());

    await expect(cancelAt(170)).resolves.toEqual({ fee: 0 });

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 460, 'refund-cancel-pi_charged');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'refunded',
      capturedAmount: 0,
    });
    expect(cards.releaseHold).not.toHaveBeenCalled();
  });

  it('keeps one night per pet from 72 hours to 7 days, and refunds the rest', async () => {
    lock(chargedBooking());

    await expect(cancelAt(100)).resolves.toEqual({ fee: 120 });

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 340, 'refund-cancel-pi_charged');
    expect(settlePayment).toHaveBeenCalledWith(client, 'payment-1', {
      status: 'succeeded',
      capturedAmount: 120,
    });
  });

  it('keeps half of each stay inside the last 72 hours', async () => {
    lock(chargedBooking());

    await expect(cancelAt(30)).resolves.toEqual({ fee: 230 });

    expect(cards.refund).toHaveBeenCalledWith('pi_charged', 230, 'refund-cancel-pi_charged');
  });

  it('gives the current terms no free window right after confirmation', async () => {
    const justConfirmed = hoursBeforeDropOff(101);
    lock(
      chargedBooking({
        termsVersion: 'concierge-terms-2026-10-06',
        pets: [
          lockedPet({ approvedAt: justConfirmed }),
          lockedPet({ bookingPetsUuid: 'pet-b', approvedAt: justConfirmed }),
        ],
      }),
    );

    // One hour after confirmation, 100 hours before drop-off: one night per pet, no grace.
    await expect(cancelAt(100)).resolves.toEqual({ fee: 120 });
  });
});
