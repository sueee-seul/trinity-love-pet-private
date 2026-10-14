import { describe, expect, it } from 'vitest';
import {
  noticeFactsOf,
  parseStayDates,
  splitPetNames,
} from '../services/booking.notification.facts.js';
import {
  approvedBody,
  backInReviewBody,
  bookingConfirmedBody,
  datesChangedBody,
  refusedBody,
  requestReceivedBody,
} from '../services/booking.notification.messages.js';

/** 12 to 15 Oct 2026 in Auckland (NZDT, UTC+13). */
const OCTOBER_STAY = {
  petNames: ['Max', 'Bella'],
  dropOffTime: new Date('2026-10-11T21:00:00Z'),
  pickUpTime: new Date('2026-10-14T23:00:00Z'),
};
const OCTOBER = { start: '2026-10-12', end: '2026-10-15' };

describe('notice facts read back from every notice sentence', () => {
  it('reads a booking confirmed at checkout', () => {
    expect(
      noticeFactsOf('booking_approved', bookingConfirmedBody(OCTOBER_STAY, 'PB-1A2B3C')),
    ).toEqual({
      template: 'confirmed',
      reference: 'PB-1A2B3C',
      pets: ['Max', 'Bella'],
      dates: OCTOBER,
    });
  });

  it('reads a request with confirmed pets and pets our manager checks first', () => {
    const body = requestReceivedBody(
      { ...OCTOBER_STAY, petNames: ['Max', 'Bella', 'Coco'] },
      'PB-1',
      [
        { name: 'Max', reasons: [] },
        { name: 'Bella', reasons: ['medication'] },
        { name: 'Coco', reasons: ['medication'] },
      ],
    );

    expect(noticeFactsOf('booking_request_received', body)).toEqual({
      template: 'received',
      reference: 'PB-1',
      dates: OCTOBER,
      confirmed: ['Max'],
      waiting: [
        { name: 'Bella', reasons: ['medication'] },
        { name: 'Coco', reasons: ['medication'] },
      ],
    });
  });

  it('reads a decision, a refusal with its reason, a reopened request and moved dates', () => {
    expect(noticeFactsOf('booking_approved', approvedBody(OCTOBER_STAY))).toEqual({
      template: 'approved',
      pets: ['Max', 'Bella'],
      dates: OCTOBER,
    });
    expect(
      noticeFactsOf(
        'booking_refused',
        refusedBody(OCTOBER_STAY, 'We are fully booked on those dates.'),
      ),
    ).toEqual({
      template: 'refused',
      pets: ['Max', 'Bella'],
      dates: OCTOBER,
      reason: 'We are fully booked on those dates.',
    });
    expect(noticeFactsOf('booking_back_in_review', backInReviewBody(OCTOBER_STAY))).toEqual({
      template: 'reopened',
      pets: ['Max', 'Bella'],
      dates: OCTOBER,
    });
    expect(noticeFactsOf('booking_back_in_review', datesChangedBody(OCTOBER_STAY))).toEqual({
      template: 'moved',
      pets: ['Max', 'Bella'],
      dates: OCTOBER,
    });
  });

  // Older notices used other words; the rows are still in the bell.
  it('reads the older wording too', () => {
    expect(
      noticeFactsOf(
        'booking_request_received',
        'We got your request PB-9 for Max and Bella, 12 to 15 Oct 2026. Nothing is booked until our manager approves each pet.',
      ),
    ).toEqual({
      template: 'received',
      reference: 'PB-9',
      dates: OCTOBER,
      confirmed: [],
      waiting: [
        { name: 'Max', reasons: [] },
        { name: 'Bella', reasons: [] },
      ],
    });
    expect(
      noticeFactsOf(
        'booking_approved',
        "Max's stay, 12 to 15 Oct 2026, is approved. Nothing else.",
      ),
    ).toEqual({ template: 'approved', pets: ['Max'], dates: OCTOBER });
    expect(
      noticeFactsOf(
        'booking_request_received',
        'We got your request PB-2. Our manager checks Max (first stay with us, stays more than 14 nights) before confirming.',
      ),
    ).toMatchObject({ waiting: [{ name: 'Max', reasons: ['first_stay', 'long_stay'] }] });
  });

  it('keeps commas in a list of names apart from the dates', () => {
    const body = bookingConfirmedBody(
      { ...OCTOBER_STAY, petNames: ['Max', 'Bella', 'Coco'] },
      'PB-3',
    );
    expect(noticeFactsOf('booking_approved', body)).toMatchObject({
      pets: ['Max', 'Bella', 'Coco'],
      dates: OCTOBER,
    });
  });

  it('gives null for a sentence the notices never write', () => {
    expect(noticeFactsOf('booking_refused', 'Something else entirely.')).toBeNull();
  });
});

describe('notice fact parts', () => {
  it('reads every date shape', () => {
    expect(parseStayDates('28 Sep to 2 Oct 2026')).toEqual({
      start: '2026-09-28',
      end: '2026-10-02',
    });
    expect(parseStayDates('30 Dec 2026 to 2 Jan 2027')).toEqual({
      start: '2026-12-30',
      end: '2027-01-02',
    });
    expect(parseStayDates('next week')).toBeNull();
  });

  it('treats "your pet" as no name', () => {
    expect(splitPetNames('your pet')).toEqual([]);
    expect(splitPetNames('Max, Bella and Coco')).toEqual(['Max', 'Bella', 'Coco']);
  });
});
