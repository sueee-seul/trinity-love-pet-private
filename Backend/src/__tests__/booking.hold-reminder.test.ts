import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  BOOKING_ARRIVAL_UNMARKED,
  BOOKING_CARD_HOLD_FAILED,
} from '../contracts/booking.notification.contract.js';
import type {
  DueBooking,
  GuaranteePaymentStatus,
  HoldResult,
  ManagerFlag,
  UnmarkedArrival,
} from '../repositories/booking.hold-reminder.repository.js';
import {
  flagUnmarkedArrivals,
  runBookingJobs,
  runHoldAndReminderPass,
  type BookingJobContext,
  type HoldReminderStore,
} from '../services/booking.hold-reminder.js';
import type { OutboundEmail } from '../services/concierge/concierge.email.js';
import type { CardProcessor } from '../services/payments/card-processor.js';

const BOOKING_ID = '1a2b3c4d-0000-4000-8000-000000000001';
const REFERENCE = 'PB-1A2B3C';

/** Drop-off 10:30 on Sat 12 Dec 2026 in Auckland (NZDT, UTC+13). */
const DROP_OFF = new Date('2026-12-11T21:30:00Z');
/** 15 minutes into the hold window: 10:45 on Thu 10 Dec. */
const IN_HOLD_WINDOW = new Date('2026-12-09T21:45:00Z');
/** One hold per booking and drop-off time. */
const HOLD_KEY = `hold-booking-${BOOKING_ID}-${DROP_OFF.getTime()}`;

const dueBooking = (overrides: Partial<DueBooking> = {}): DueBooking => ({
  bookingId: BOOKING_ID,
  // Older terms by default: held 48 hours ahead, first-night fees.
  paysAtRequest: false,
  termsVersion: '',
  bookedAt: new Date('2026-11-01T01:00:00Z'),
  dropOffAt: DROP_OFF,
  pickUpAt: new Date('2026-12-15T03:00:00Z'),
  ownerEmail: 'ava@example.test',
  ownerFirstName: 'Ava',
  petNames: ['Biscuit'],
  amount: 230,
  approvedPets: [
    {
      price: 230,
      nightlyRate: 60,
      approvedAt: new Date('2026-11-02T01:00:00Z'),
      dropOffAt: DROP_OFF,
    },
  ],
  paymentStatus: 'pending',
  releasedHoldId: null,
  processor: 'stripe',
  paymentMethodId: 'pm_saved',
  ...overrides,
});

/** The SQL store's guards, in memory: one hold per booking, one reminder, one flag of each kind. */
class MemoryStore implements HoldReminderStore {
  bookings: DueBooking[] = [];
  arrivals: UnmarkedArrival[] = [];
  holds = new Map<string, HoldResult>();
  reminders = new Map<string, Date>();
  flags: ManagerFlag[] = [];
  /** Bookings that changed (e.g. were cancelled) while their card was being held. */
  changedMeanwhile = new Set<string>();
  askedForToday: string | null = null;
  askedForHours: number | null = null;

  private statusOf(booking: DueBooking): GuaranteePaymentStatus {
    return this.holds.get(booking.bookingId)?.status ?? booking.paymentStatus;
  }

  async findDueBookings(_now: Date, holdHours: number): Promise<DueBooking[]> {
    this.askedForHours = holdHours;
    return this.bookings
      .filter((booking) => !this.reminders.has(booking.bookingId))
      .map((booking) => ({ ...booking, paymentStatus: this.statusOf(booking) }));
  }

  async recordHold(
    bookingId: string,
    result: HoldResult,
    flag: ManagerFlag | null,
  ): Promise<boolean> {
    if (this.changedMeanwhile.has(bookingId) || this.holds.has(bookingId)) return false;
    this.holds.set(bookingId, result);
    if (flag) this.flags.push(flag);
    return true;
  }

  async markReminderSent(bookingId: string, at: Date): Promise<void> {
    if (!this.reminders.has(bookingId)) this.reminders.set(bookingId, at);
  }

  async findUnmarkedArrivals(today: string): Promise<UnmarkedArrival[]> {
    this.askedForToday = today;
    return this.arrivals.filter(
      (arrival) =>
        !this.flags.some(
          (flag) =>
            flag.bookingId === arrival.bookingId && flag.setting === BOOKING_ARRIVAL_UNMARKED,
        ),
    );
  }

  async flagManagers(flag: ManagerFlag): Promise<void> {
    this.flags.push(flag);
  }
}

const processorStub = (
  overrides: Partial<Pick<CardProcessor, 'name' | 'testMode'>> = {},
): CardProcessor => ({
  name: 'stripe',
  publishableKey: 'pk_test_example',
  testMode: true,
  createCardSetup: vi.fn(),
  readCardSetup: vi.fn(),
  placeHold: vi.fn<CardProcessor['placeHold']>(async (request) => ({
    status: 'succeeded',
    paymentIntentId: `pi_${request.idempotencyKey}`,
  })),
  captureHold: vi.fn(),
  releaseHold: vi.fn<CardProcessor['releaseHold']>(async () => undefined),
  refund: vi.fn<CardProcessor['refund']>(async () => undefined),
  chargeNow: vi.fn(),
  ...overrides,
});

let store: MemoryStore;
let processor: CardProcessor;
let sent: OutboundEmail[];
let log: Mock<(message: string) => void>;

const sender = {
  sendVerificationCode: vi.fn(),
  sendBookingEmail: vi.fn<(email: OutboundEmail) => Promise<void>>(),
};

const contextAt = (now: Date, overrides: Partial<BookingJobContext> = {}): BookingJobContext => ({
  store,
  cardProcessor: processor,
  emailSender: sender,
  contact: { email: 'bookings@wagstay.example', phone: '09 555 0100' },
  now,
  log,
  ...overrides,
});

beforeEach(() => {
  store = new MemoryStore();
  store.bookings = [dueBooking()];
  processor = processorStub();
  sent = [];
  log = vi.fn<(message: string) => void>();
  sender.sendBookingEmail.mockReset();
  sender.sendBookingEmail.mockImplementation(async (email) => {
    sent.push(email);
  });
});

describe('the 48-hour hold and reminder', () => {
  it('holds again under a new key after the approved pets changed and the old hold was released', async () => {
    store.bookings = [dueBooking({ releasedHoldId: 'pi_released', amount: 115 })];

    await runBookingJobs(contextAt(IN_HOLD_WINDOW));

    // Reusing the released hold's key would make the processor answer with that released hold.
    expect(processor.placeHold).toHaveBeenCalledWith({
      paymentMethodId: 'pm_saved',
      amount: 115,
      reference: REFERENCE,
      idempotencyKey: `${HOLD_KEY}-after-pi_released`,
    });
    expect(store.holds.get(BOOKING_ID)).toMatchObject({ status: 'authorized', amount: 115 });
  });

  it('holds the full price 48 hours before drop-off, then sends one reminder', async () => {
    await runBookingJobs(contextAt(IN_HOLD_WINDOW));

    expect(store.askedForHours).toBe(48);
    expect(processor.placeHold).toHaveBeenCalledWith({
      paymentMethodId: 'pm_saved',
      amount: 230,
      reference: REFERENCE,
      idempotencyKey: HOLD_KEY,
    });
    expect(store.holds.get(BOOKING_ID)).toEqual({
      status: 'authorized',
      paymentIntentId: `pi_${HOLD_KEY}`,
      amount: 230,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ava@example.test');
    expect(sent[0]?.subject).toBe('Your Wagstay stay starts Sat 12 Dec: what to bring');
    expect(sent[0]?.text).toContain("we've held $230.00 on your card");
    // Approved weeks ago, 48 hours out: the first night is what cancelling costs now.
    expect(sent[0]?.text).toContain(
      'Cancelling now costs $60.00. My Stays shows your current cancellation fee before you confirm.',
    );
    expect(store.reminders.get(BOOKING_ID)).toEqual(IN_HOLD_WINDOW);

    // The next run finds nothing left to do.
    await runBookingJobs(contextAt(new Date(IN_HOLD_WINDOW.getTime() + 15 * 60_000)));
    expect(processor.placeHold).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
  });

  it('does not promise a free cancellation that ends two hours after a late approval', async () => {
    store.bookings = [
      dueBooking({
        approvedPets: [
          {
            price: 230,
            nightlyRate: 60,
            approvedAt: new Date(IN_HOLD_WINDOW.getTime() - 30 * 60_000),
            dropOffAt: DROP_OFF,
          },
        ],
      }),
    ];

    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(sent[0]?.text).not.toContain('Cancelling now costs');
    expect(sent[0]?.text).not.toMatch(/cancel for free/i);
    expect(sent[0]?.text).toContain('My Stays shows your current cancellation fee');
  });

  it('keeps the booking, asks for another card and flags managers when the bank refuses', async () => {
    vi.mocked(processor.placeHold).mockResolvedValue({
      status: 'failed',
      paymentIntentId: 'pi_declined',
      reason: 'declined',
    });

    const summary = await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(summary).toMatchObject({ held: 0, refused: 1, reminded: 1 });
    expect(store.holds.get(BOOKING_ID)).toEqual({
      status: 'failed',
      paymentIntentId: 'pi_declined',
      amount: 230,
    });
    expect(store.flags).toEqual([
      expect.objectContaining({ bookingId: BOOKING_ID, setting: BOOKING_CARD_HOLD_FAILED }),
    ]);
    expect(store.flags[0]?.summary).toContain(REFERENCE);
    expect(sent[0]?.subject).toBe(
      "Action needed: we couldn't hold your card for your Wagstay stay",
    );
    expect(sent[0]?.text).toContain(
      'To give us another card before check-in, email bookings@wagstay.example or call 09 555 0100.',
    );

    // A declined card is not tried again.
    await runHoldAndReminderPass(contextAt(new Date(IN_HOLD_WINDOW.getTime() + 15 * 60_000)));
    expect(processor.placeHold).toHaveBeenCalledTimes(1);
  });

  it('only reminds a booking whose card was already held at checkout', async () => {
    store.bookings = [dueBooking({ paymentStatus: 'authorized' })];

    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(processor.placeHold).not.toHaveBeenCalled();
    expect(sent[0]?.subject).toContain('what to bring');
  });

  it('tries again on the next run when the processor cannot be reached', async () => {
    vi.mocked(processor.placeHold).mockRejectedValueOnce(new TypeError('fetch failed'));

    const first = await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(first).toMatchObject({ held: 0, retryLater: 1 });
    expect(store.holds.size).toBe(0);
    expect(sent).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(`Booking job: ${REFERENCE} left for the next run (TypeError)`);

    const second = await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(second).toMatchObject({ held: 1, reminded: 1 });
  });

  it('keeps the hold when the email fails, and later sends only the email', async () => {
    sender.sendBookingEmail.mockRejectedValueOnce(new Error('SES throttled'));

    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(store.holds.get(BOOKING_ID)?.status).toBe('authorized');
    expect(store.reminders.has(BOOKING_ID)).toBe(false);

    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(processor.placeHold).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(store.reminders.has(BOOKING_ID)).toBe(true);
  });

  it('releases a hold at once when the booking changed while it was being placed', async () => {
    store.changedMeanwhile.add(BOOKING_ID);

    const summary = await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(processor.releaseHold).toHaveBeenCalledWith(`pi_${HOLD_KEY}`);
    expect(summary.skipped).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('leaves a card saved with another processor alone', async () => {
    store.bookings = [dueBooking({ processor: 'fake' })];

    const summary = await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));

    expect(summary.skipped).toBe(1);
    expect(processor.placeHold).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('still holds cards while email is not set up, and sends the reminder once it is', async () => {
    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW, { emailSender: null }));
    expect(store.holds.get(BOOKING_ID)?.status).toBe('authorized');
    expect(store.reminders.has(BOOKING_ID)).toBe(false);

    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(processor.placeHold).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
  });

  it('says a test is a test, and never says so for a real hold', async () => {
    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(sent[0]?.text).toContain('This is a test booking: no real card was held.');

    store = new MemoryStore();
    store.bookings = [dueBooking()];
    processor = processorStub({ testMode: false });
    sent = [];
    await runHoldAndReminderPass(contextAt(IN_HOLD_WINDOW));
    expect(sent[0]?.text).not.toContain('This is a test booking');
  });
});

describe('arrivals nobody recorded', () => {
  const arrival: UnmarkedArrival = {
    bookingId: BOOKING_ID,
    dropOffAt: new Date('2026-12-11T21:30:00Z'),
    petNames: ['Biscuit'],
  };

  it('flags each one for managers once, from 8am the next morning', async () => {
    store.arrivals = [arrival];

    // 7:30 on Sun 13 Dec in Auckland: too early.
    await expect(flagUnmarkedArrivals(contextAt(new Date('2026-12-12T18:30:00Z')))).resolves.toBe(
      0,
    );
    expect(store.flags).toHaveLength(0);

    // 8:05 the same morning.
    const morning = contextAt(new Date('2026-12-12T19:05:00Z'));
    await expect(flagUnmarkedArrivals(morning)).resolves.toBe(1);
    expect(store.askedForToday).toBe('2026-12-13');
    expect(store.flags).toEqual([
      {
        bookingId: BOOKING_ID,
        setting: BOOKING_ARRIVAL_UNMARKED,
        summary: `Arrival not recorded for ${REFERENCE} (drop-off Sat 12 Dec). Record each pet as checked in, no-show or Wagstay unable.`,
      },
    ]);

    await expect(flagUnmarkedArrivals(morning)).resolves.toBe(0);
    expect(store.flags).toHaveLength(1);
  });
});
