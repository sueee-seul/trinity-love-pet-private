import { describe, expect, it } from 'vitest';
import {
  PARENT_NOTIFICATION_TITLES,
  addOnBookedBody,
  approvedBody,
  managerInStayChangeBody,
  stayExtendedBody,
  timesChangedBody,
  backInReviewBody,
  bookingConfirmedBody,
  cancelledByParentBody,
  formatStayDates,
  joinPetNames,
  managerRequestBody,
  noticeTitle,
  refusedBody,
  requestReceivedBody,
} from '../services/booking.notification.messages.js';
import { STAY_STATUS_LABELS } from '../services/stay-status.js';

// 9am on 12 Oct and 5pm on 15 Oct in Auckland (NZDT, UTC+13).
const MAX_STAY = {
  petNames: ['Max'],
  dropOffTime: new Date('2026-10-11T20:00:00.000Z'),
  pickUpTime: new Date('2026-10-15T04:00:00.000Z'),
};

const BELLA_ON_MEDICATION = { name: 'Bella', reasons: ['medication'] as const };
const MAX_CONFIRMED = { name: 'Max', reasons: [] };

const EVERY_BODY = [
  bookingConfirmedBody(MAX_STAY, 'PB-ABC123'),
  requestReceivedBody(MAX_STAY, 'PB-ABC123', [
    MAX_CONFIRMED,
    { ...BELLA_ON_MEDICATION, reasons: ['medication'] },
  ]),
  approvedBody(MAX_STAY),
  refusedBody(MAX_STAY, 'We are full that week.'),
  backInReviewBody(MAX_STAY),
  managerRequestBody(MAX_STAY, 'PB-ABC123', [{ ...BELLA_ON_MEDICATION, reasons: ['medication'] }]),
  cancelledByParentBody(MAX_STAY, 'PB-ABC123', 60),
];

describe('booking notice dates', () => {
  it('writes a stay inside one month once, on Auckland days', () => {
    expect(formatStayDates(MAX_STAY.dropOffTime, MAX_STAY.pickUpTime)).toBe('12 to 15 Oct 2026');
  });

  it('names both months, and both years, only when the stay crosses them', () => {
    expect(
      formatStayDates(new Date('2026-09-27T21:00:00.000Z'), new Date('2026-10-02T04:00:00.000Z')),
    ).toBe('28 Sep to 2 Oct 2026');
    expect(
      formatStayDates(new Date('2026-12-29T20:00:00.000Z'), new Date('2027-01-02T04:00:00.000Z')),
    ).toBe('30 Dec 2026 to 2 Jan 2027');
  });

  it('counts a late UTC evening as the next day in Auckland', () => {
    // 11pm UTC on 11 Oct is noon on 12 Oct in Auckland.
    expect(
      formatStayDates(new Date('2026-10-11T23:00:00.000Z'), new Date('2026-10-12T23:00:00.000Z')),
    ).toBe('12 to 13 Oct 2026');
  });
});

describe('booking notice words', () => {
  it('joins pet names the way a person would say them', () => {
    expect(joinPetNames(['Max'])).toBe('Max');
    expect(joinPetNames(['Max', 'Bella'])).toBe('Max and Bella');
    expect(joinPetNames(['Max', ' Bella ', 'Coco'])).toBe('Max, Bella and Coco');
    expect(joinPetNames(['  '])).toBe('your pet');
  });

  it('tells the parent a booking confirmed at checkout has its boarding pass', () => {
    expect(bookingConfirmedBody({ ...MAX_STAY, petNames: ['Max', 'Bella'] }, 'PB-ABC123')).toBe(
      'Your booking PB-ABC123 for Max and Bella, 12 to 15 Oct 2026, is confirmed. ' +
        'Your boarding pass is in My stays.',
    );
  });

  it('names who is confirmed and who a manager checks first, with the reason', () => {
    const body = requestReceivedBody(MAX_STAY, 'PB-ABC123', [
      MAX_CONFIRMED,
      { name: 'Bella', reasons: ['medication'] },
    ]);

    expect(body).toBe(
      'We got your request PB-ABC123, 12 to 15 Oct 2026. Max is confirmed. ' +
        'Our manager checks Bella (takes medication) before confirming. ' +
        'We hold the full price on your card, and charge the confirmed pets once our manager has decided.',
    );
  });

  it('never calls a stay confirmed when every pet waits for the manager', () => {
    const body = requestReceivedBody(MAX_STAY, 'PB-ABC123', [
      { name: 'Max', reasons: ['medication'] },
    ]);

    expect(body).toBe(
      'We got your request PB-ABC123, 12 to 15 Oct 2026. ' +
        'Our manager checks Max (takes medication) before confirming. ' +
        'We hold the full price on your card, and charge the confirmed pets once our manager has decided.',
    );
    expect(body).not.toMatch(/Max is confirmed|booked/i);
  });

  it('tells the parent an approved stay has its boarding pass', () => {
    expect(approvedBody(MAX_STAY)).toBe(
      "Max's stay, 12 to 15 Oct 2026, is confirmed. Your boarding pass is in My stays.",
    );
  });

  it("gives the manager's reason with a refusal, trimmed", () => {
    expect(refusedBody(MAX_STAY, '  We are full that week.  ')).toBe(
      "We can't take Max on 12 to 15 Oct 2026. Reason: We are full that week.",
    );
  });

  it('says a reopened request is waiting for review again', () => {
    expect(backInReviewBody(MAX_STAY)).toBe(
      "Our manager has reopened Max's request for 12 to 15 Oct 2026. " +
        'It is waiting for review again.',
    );
  });

  it('leaves the dates out when a stay has none rather than printing a blank', () => {
    const undated = { petNames: ['Max'], dropOffTime: null, pickUpTime: null };

    expect(approvedBody(undated)).toBe(
      "Max's stay is confirmed. Your boarding pass is in My stays.",
    );
    expect(refusedBody(undated, 'Full.')).toBe("We can't take Max. Reason: Full.");
  });

  it('gives managers only the pets to check, why, the dates and the reference', () => {
    expect(
      managerRequestBody(MAX_STAY, 'PB-ABC123', [{ name: 'Bella', reasons: ['medication'] }]),
    ).toBe('Please review Bella (takes medication), 12 to 15 Oct 2026. ' + 'Reference PB-ABC123.');
  });

  it('titles decisions with the same words as the stay pages', () => {
    expect(PARENT_NOTIFICATION_TITLES.booking_approved).toBe(STAY_STATUS_LABELS.approved);
    expect(PARENT_NOTIFICATION_TITLES.booking_refused).toBe(STAY_STATUS_LABELS.refused);
  });

  it('never uses an em dash or an en dash', () => {
    const everyWord = [...EVERY_BODY, ...Object.values(PARENT_NOTIFICATION_TITLES)].join('\n');

    expect(everyWord).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('notices about a change to a stay under way', () => {
  it('name the change and the money as a receipt would', () => {
    expect(stayExtendedBody(MAX_STAY, '2026-10-17', 2, 240, 'card')).toBe(
      "Max's stay now ends on 17 Oct 2026: 2 nights more at the rates you booked. $240.00 was charged to your saved card.",
    );
    expect(addOnBookedBody('Max', 'Outdoor Walk', 2, '2026-10-13', 30, 'card')).toBe(
      '2 x Outdoor Walk booked for Max on 13 Oct 2026. $30.00 was charged to your saved card.',
    );
    expect(addOnBookedBody('Max', 'Grooming: bath and brush', 1, '2026-10-13', 55, 'card')).toBe(
      'Grooming: bath and brush booked for Max on 13 Oct 2026. $55.00 was charged to your saved card.',
    );
  });

  it('say the amount is on the bill for check-out when the booking has no saved card', () => {
    expect(stayExtendedBody(MAX_STAY, '2026-10-17', 2, 240, 'desk')).toBe(
      "Max's stay now ends on 17 Oct 2026: 2 nights more at the rates you booked. $240.00 was added to your bill. You pay it at the desk when you check out.",
    );
    expect(addOnBookedBody('Max', 'Outdoor Walk', 1, '2026-10-13', 15, 'desk')).toBe(
      'Outdoor Walk booked for Max on 13 Oct 2026. $15.00 was added to your bill. You pay it at the desk when you check out.',
    );
  });

  it('read the new times on the stay dates, and tell managers the reference', () => {
    expect(timesChangedBody('Max', MAX_STAY.dropOffTime, MAX_STAY.pickUpTime)).toBe(
      "Max's times are now: check-in 9:00 am, check-out 5:00 pm, on 12 to 15 Oct 2026.",
    );
    expect(
      managerInStayChangeBody(MAX_STAY, 'PB-ABC123', 'the parent extended the stay to 2026-10-17.'),
    ).toBe('Max: the parent extended the stay to 2026-10-17. Reference PB-ABC123.');
  });

  it('have a title for every in-stay change', () => {
    expect(PARENT_NOTIFICATION_TITLES.booking_extended).toBe('Stay extended');
    // Kept for notices sent before pick-up coordination was removed, in check-out words.
    expect(PARENT_NOTIFICATION_TITLES.booking_picked_up_early).toBe('Early check-out');
    expect(PARENT_NOTIFICATION_TITLES.booking_picked_up).toBe('Checked out');
    expect(PARENT_NOTIFICATION_TITLES.booking_add_on_booked).toBe('Add-on booked');
    expect(PARENT_NOTIFICATION_TITLES.booking_times_changed).toBe('Time changed');
    expect(PARENT_NOTIFICATION_TITLES.booking_cancelled_by_parent).toBe(
      STAY_STATUS_LABELS.cancelled,
    );
    expect(PARENT_NOTIFICATION_TITLES.booking_arrival_note).toBe('Settled in');
  });

  it('title the updates in Chinese when the body was written in Chinese', () => {
    expect(noticeTitle('booking_daily_update', 'zh')).toBe('今日动态');
    expect(noticeTitle('booking_arrival_note', 'zh')).toBe('已安顿');
    expect(noticeTitle('booking_daily_update', 'en')).toBe("Today's update");
    // A kind with no Chinese body yet keeps its English title.
    expect(noticeTitle('booking_approved', 'zh')).toBe(PARENT_NOTIFICATION_TITLES.booking_approved);
  });
});

describe('the receipt after the parent cancels', () => {
  it('says what was kept under the agreed rules and that the rest comes back', () => {
    expect(cancelledByParentBody(MAX_STAY, 'PB-ABC123', 60)).toBe(
      "You cancelled Max's stay, 12 to 15 Oct 2026, reference PB-ABC123. $60.00 was kept under the cancellation rules you agreed to; the rest goes back to your card.",
    );
  });

  it('says nothing was charged when the cancellation was free', () => {
    expect(cancelledByParentBody(MAX_STAY, 'PB-ABC123', 0)).toBe(
      "You cancelled Max's stay, 12 to 15 Oct 2026, reference PB-ABC123. Nothing was charged; anything held or paid goes back to your card.",
    );
  });
});
