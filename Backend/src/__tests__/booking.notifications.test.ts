import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewedBookingPet } from '../repositories/manager.booking.review.repository.js';

const emails = vi.hoisted(() => ({ sendBookingNoticeEmail: vi.fn() }));
vi.mock('../services/booking.transaction-emails.js', () => emails);

const repository = vi.hoisted(() => ({
  findBookingRequestSubject: vi.fn(),
  recordParentNotice: vi.fn(),
  recordManagerRequestNotices: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/booking.notification.repository.js', () => repository);

import {
  composeApprovedNotice,
  composeBackInReviewNotice,
  composeRefusedNotice,
  notifyBookingDatesChanged,
  notifyBookingPlaced,
} from '../services/booking.notifications.js';

const BOOKING_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OWNER_ID = '00000000-0000-4000-8000-000000000301';

// 9am on 12 Oct and 5pm on 15 Oct in Auckland.
const STAY = {
  dropOffTime: new Date('2026-10-11T20:00:00.000Z'),
  pickUpTime: new Date('2026-10-15T04:00:00.000Z'),
};

const reviewed = (overrides: Partial<ReviewedBookingPet> = {}): ReviewedBookingPet => ({
  bookingId: BOOKING_ID,
  ownerId: OWNER_ID,
  subject: { petNames: ['Max'], ...STAY },
  previousStatus: 'pending',
  previousRefusalReason: null,
  ...overrides,
});

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  repository.findBookingRequestSubject.mockResolvedValue({
    ownerId: OWNER_ID,
    petNames: ['Max', 'Bella'],
    ...STAY,
  });
  repository.recordParentNotice.mockResolvedValue(undefined);
  repository.recordManagerRequestNotices.mockResolvedValue(2);
});

afterEach(() => {
  consoleError.mockRestore();
});

const CONFIRMED = [
  { name: 'Max', reasons: [] },
  { name: 'Bella', reasons: [] },
];
const BELLA_WAITS = [
  { name: 'Max', reasons: [] },
  { name: 'Bella', reasons: ['medication' as const] },
];

describe('notifyBookingPlaced (checkout)', () => {
  it('does not keep the guest waiting on the mail provider', async () => {
    emails.sendBookingNoticeEmail.mockReturnValueOnce(new Promise(() => undefined));

    await expect(notifyBookingPlaced(BOOKING_ID, CONFIRMED)).resolves.toBeUndefined();
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledTimes(1);
  });

  it('tells the parent a booking confirmed at checkout is confirmed, and no manager', async () => {
    await notifyBookingPlaced(BOOKING_ID, CONFIRMED);

    const notice = {
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_approved',
      body:
        'Your booking PB-AAAAAA for Max and Bella, 12 to 15 Oct 2026, is confirmed. ' +
        'Your boarding pass is in My stays.',
    };
    expect(repository.findBookingRequestSubject).toHaveBeenCalledWith(BOOKING_ID);
    expect(repository.recordParentNotice).toHaveBeenCalledWith(notice);
    // The receipt email carries a copy of the terms the booking agreed to.
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledWith({
      ...notice,
      withAgreedTerms: true,
    });
    expect(repository.recordManagerRequestNotices).not.toHaveBeenCalled();
  });

  it('tells the parent which stay a manager checks first, and why', async () => {
    await notifyBookingPlaced(BOOKING_ID, BELLA_WAITS);

    expect(repository.recordParentNotice).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_request_received',
      body:
        'We got your request PB-AAAAAA, 12 to 15 Oct 2026. Max is confirmed. ' +
        'Our manager checks Bella (takes medication) before confirming. ' +
        'We hold the full price on your card, and charge the confirmed pets once our manager has decided.',
    });
  });

  it('asks every active manager to review only the waiting stays', async () => {
    await notifyBookingPlaced(BOOKING_ID, BELLA_WAITS);

    expect(repository.recordManagerRequestNotices).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      body: 'Please review Bella (takes medication), 12 to 15 Oct 2026. Reference PB-AAAAAA.',
    });
  });

  it('still tells the managers when the parent notice fails, and never throws', async () => {
    repository.recordParentNotice.mockRejectedValue(new Error('insert failed'));

    await expect(notifyBookingPlaced(BOOKING_ID, BELLA_WAITS)).resolves.toBeUndefined();

    expect(repository.recordManagerRequestNotices).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('logs ids only, never the pet names in the notice', async () => {
    repository.recordManagerRequestNotices.mockRejectedValue(new Error('Max and Bella'));

    await notifyBookingPlaced(BOOKING_ID, BELLA_WAITS);

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain(BOOKING_ID);
    expect(logged).not.toContain('Bella');
  });

  it('writes nothing, and does not throw, when the booking cannot be read', async () => {
    repository.findBookingRequestSubject.mockRejectedValueOnce(new Error('db down'));
    await expect(notifyBookingPlaced(BOOKING_ID, CONFIRMED)).resolves.toBeUndefined();

    repository.findBookingRequestSubject.mockResolvedValueOnce(null);
    await expect(notifyBookingPlaced(BOOKING_ID, CONFIRMED)).resolves.toBeUndefined();

    expect(emails.sendBookingNoticeEmail).not.toHaveBeenCalled();
    expect(repository.recordParentNotice).not.toHaveBeenCalled();
    expect(repository.recordManagerRequestNotices).not.toHaveBeenCalled();
  });
});

describe('notifyBookingDatesChanged (a guest moved their stay)', () => {
  it('tells the parent the new dates wait for review and nothing is held, in the bell and by email', async () => {
    await notifyBookingDatesChanged(BOOKING_ID);

    const notice = {
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_back_in_review',
      body: "You moved Max and Bella's stay to 12 to 15 Oct 2026. Our manager will review the new dates. Nothing is held on your card until they approve.",
    };
    expect(repository.recordParentNotice).toHaveBeenCalledWith(notice);
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledWith(notice);
  });

  it('asks every active manager to review the stay again', async () => {
    await notifyBookingDatesChanged(BOOKING_ID);

    expect(repository.recordManagerRequestNotices).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      body: "The guest moved Max and Bella's stay to 12 to 15 Oct 2026. Please review it again. Reference PB-AAAAAA.",
    });
  });

  it('never throws when the notices cannot be written', async () => {
    repository.recordParentNotice.mockRejectedValue(new Error('db down'));
    repository.recordManagerRequestNotices.mockRejectedValue(new Error('db down'));

    await expect(notifyBookingDatesChanged(BOOKING_ID)).resolves.toBeUndefined();
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalled();
  });
});

describe('decision notices', () => {
  it('tells the parent a pet was approved', () => {
    expect(composeApprovedNotice(reviewed())).toEqual({
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_approved',
      body: "Max's stay, 12 to 15 Oct 2026, is confirmed. Your boarding pass is in My stays.",
    });
    expect(composeApprovedNotice(reviewed({ previousStatus: 'refused' }))?.kind).toBe(
      'booking_approved',
    );
  });

  it('says nothing when an approved pet is approved again', () => {
    expect(composeApprovedNotice(reviewed({ previousStatus: 'approved' }))).toBeNull();
  });

  it("tells the parent a pet was refused, with the manager's reason", () => {
    expect(composeRefusedNotice('We are full that week.')(reviewed())).toEqual({
      ownerId: OWNER_ID,
      bookingId: BOOKING_ID,
      kind: 'booking_refused',
      body: "We can't take Max on 12 to 15 Oct 2026. Reason: We are full that week.",
    });
  });

  it('tells the parent again only when a refusal reason changes', () => {
    const alreadyRefused = reviewed({
      previousStatus: 'refused',
      previousRefusalReason: 'We are full that week.',
    });

    expect(composeRefusedNotice(' We are full that week. ')(alreadyRefused)).toBeNull();
    expect(composeRefusedNotice('No space for large dogs.')(alreadyRefused)?.body).toContain(
      'Reason: No space for large dogs.',
    );
  });

  it('tells the parent a decision was undone and the request waits for review again', () => {
    for (const previousStatus of ['approved', 'refused', 'cancelled'] as const) {
      expect(composeBackInReviewNotice(reviewed({ previousStatus }))).toEqual({
        ownerId: OWNER_ID,
        bookingId: BOOKING_ID,
        kind: 'booking_back_in_review',
        body:
          "Our manager has reopened Max's request for 12 to 15 Oct 2026. " +
          'It is waiting for review again.',
      });
    }
  });

  it('says nothing when undo leaves a waiting request where it was', () => {
    expect(composeBackInReviewNotice(reviewed({ previousStatus: 'pending' }))).toBeNull();
  });
});
