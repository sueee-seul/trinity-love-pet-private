import { describe, expect, it } from 'vitest';
import {
  BOOKING_POLICY,
  OLDER_TERMS_POLICY,
  captureAmountFor,
  dateChangeLimitFor,
  decideCancellation,
  decideReschedule,
  feeScheduleFor,
  holdTimeFor,
  lateFee,
  reviewDeadlineFor,
  shortNoticeFee,
} from '../services/booking.fee-policy.js';

const HOUR = 3_600_000;
const DROP_OFF = new Date('2026-10-12T20:00:00.000Z'); // 9am 13 Oct in Auckland (NZDT)

const hoursBefore = (hours: number): Date => new Date(DROP_OFF.getTime() - hours * HOUR);
const aMinuteAfter = (instant: Date): Date => new Date(instant.getTime() + 60_000);

describe('the policy numbers the owner chose', () => {
  it('are free 7 days ahead, one night from 72 hours, half inside 72 hours, a 24-hour review', () => {
    expect(BOOKING_POLICY).toEqual({
      freeCancellationHours: 168,
      shortNoticeHours: 72,
      shortNoticeFeePercent: 50,
      reviewWindowHours: 24,
      reviewReminderHours: 4,
      holdHoursBeforeDropOff: 48,
      lateFeeBasis: 'first_night',
      rescheduleWindowDays: 365,
    });
  });

  it('keep the grace, cooling-off and one free change only for older terms', () => {
    expect(OLDER_TERMS_POLICY).toEqual({
      coolingOffHours: 24,
      approvalGraceHours: 2,
      freeReschedules: 1,
    });
  });
});

describe('feeScheduleFor', () => {
  it('gives each terms version the rules it agreed to', () => {
    expect(feeScheduleFor('concierge-terms-2026-10-06')).toBe('tiered');
    expect(feeScheduleFor('concierge-terms-2026-11-01')).toBe('tiered');
    expect(feeScheduleFor('concierge-terms-2026-10-02')).toBe('tiered_with_grace');
    expect(feeScheduleFor('concierge-terms-2026-10-01')).toBe('first_night');
    expect(feeScheduleFor('')).toBe('first_night');
  });
});

describe('dateChangeLimitFor', () => {
  it('lets the current terms change dates as often as needed, older terms once', () => {
    expect(dateChangeLimitFor('concierge-terms-2026-10-06')).toBeNull();
    expect(dateChangeLimitFor('concierge-terms-2026-10-02')).toBe(1);
    expect(dateChangeLimitFor('')).toBe(1);
  });
});

describe('lateFee', () => {
  it('rounds half a cent up', () => {
    expect(lateFee(204, 60)).toBe(60);
    expect(lateFee(204.35, 60.355)).toBe(60.36);
    expect(lateFee(0.01, 1)).toBe(0.01);
  });
});

describe('shortNoticeFee', () => {
  it('is half the stay, rounded to the cent', () => {
    expect(shortNoticeFee(204)).toBe(102);
    expect(shortNoticeFee(84.35)).toBe(42.18);
    expect(shortNoticeFee(0)).toBe(0);
  });
});

describe('reviewDeadlineFor', () => {
  it('gives our manager 24 hours after the request', () => {
    const bookedAt = hoursBefore(240);
    expect(reviewDeadlineFor({ bookedAt, dropOffAt: DROP_OFF })).toEqual(hoursBefore(216));
  });

  it('ends at drop-off when that comes sooner', () => {
    expect(reviewDeadlineFor({ bookedAt: hoursBefore(10), dropOffAt: DROP_OFF })).toEqual(DROP_OFF);
  });
});

describe('holdTimeFor', () => {
  it('holds 48 hours before drop-off for a booking made earlier', () => {
    expect(holdTimeFor({ bookedAt: hoursBefore(240), dropOffAt: DROP_OFF })).toEqual(
      hoursBefore(48),
    );
  });

  it('holds at once for a booking made inside the last 48 hours', () => {
    const bookedAt = hoursBefore(30);
    expect(holdTimeFor({ bookedAt, dropOffAt: DROP_OFF })).toEqual(bookedAt);
    expect(holdTimeFor({ bookedAt: hoursBefore(48), dropOffAt: DROP_OFF })).toEqual(
      hoursBefore(48),
    );
  });
});

const booking = {
  total: 204,
  nightlyRate: 60,
  approvedAt: hoursBefore(240),
  bookedAt: hoursBefore(240),
  dropOffAt: DROP_OFF,
};

describe('decideCancellation under the current terms', () => {
  it('is free at exactly 7 days before drop-off', () => {
    expect(decideCancellation({ ...booking, now: hoursBefore(168) })).toEqual({
      allowed: true,
      rule: 'early',
      fee: 0,
    });
  });

  it('costs one night a minute later, down to exactly 72 hours before drop-off', () => {
    expect(decideCancellation({ ...booking, now: aMinuteAfter(hoursBefore(168)) })).toEqual({
      allowed: true,
      rule: 'late',
      fee: 60,
    });
    expect(decideCancellation({ ...booking, now: hoursBefore(72) })).toEqual({
      allowed: true,
      rule: 'late',
      fee: 60,
    });
  });

  it('never charges more for cancelling early than inside 72 hours', () => {
    // A one-night stay: its first night is the whole stay, so the fee stops at half.
    expect(
      decideCancellation({ ...booking, total: 58, nightlyRate: 58, now: hoursBefore(100) }),
    ).toEqual({ allowed: true, rule: 'late', fee: 29 });
  });

  it('costs half the stay inside the last 72 hours', () => {
    expect(decideCancellation({ ...booking, now: aMinuteAfter(hoursBefore(72)) })).toEqual({
      allowed: true,
      rule: 'short_notice',
      fee: 102,
    });
  });

  it('has no free window after confirmation', () => {
    const approvedAt = hoursBefore(80);
    expect(
      decideCancellation({ ...booking, approvedAt, now: new Date(approvedAt.getTime() + HOUR) }),
    ).toEqual({ allowed: true, rule: 'late', fee: 60 });
    expect(decideCancellation({ ...booking, approvedAt: null, now: hoursBefore(10) })).toEqual({
      allowed: true,
      rule: 'short_notice',
      fee: 102,
    });
  });

  it('lets staff waive the fee for an emergency, however late', () => {
    expect(decideCancellation({ ...booking, now: hoursBefore(1), exception: true })).toEqual({
      allowed: true,
      rule: 'exception',
      fee: 0,
    });
  });

  it('stops online cancellation at the drop-off time', () => {
    expect(decideCancellation({ ...booking, now: DROP_OFF })).toEqual({
      allowed: false,
      reason: 'after_drop_off',
    });
    expect(
      decideCancellation({ ...booking, now: new Date(DROP_OFF.getTime() + HOUR) }),
    ).toMatchObject({ allowed: false });
  });
});

describe('decideCancellation under the 2026-10-02 terms', () => {
  const graced = { ...booking, schedule: 'tiered_with_grace' as const };

  it('keeps the tiers without the half-stay cap', () => {
    expect(
      decideCancellation({ ...graced, total: 58, nightlyRate: 58, now: hoursBefore(100) }),
    ).toEqual({ allowed: true, rule: 'late', fee: 58 });
    expect(decideCancellation({ ...graced, now: aMinuteAfter(hoursBefore(72)) })).toEqual({
      allowed: true,
      rule: 'short_notice',
      fee: 102,
    });
  });

  it('is free within 24 hours of a booking made 72 hours or more ahead', () => {
    const bookedAt = hoursBefore(80);
    expect(
      decideCancellation({
        ...graced,
        bookedAt,
        approvedAt: bookedAt,
        now: new Date(bookedAt.getTime() + 24 * HOUR),
      }),
    ).toEqual({ allowed: true, rule: 'cooling_off', fee: 0 });
    expect(
      decideCancellation({
        ...graced,
        bookedAt,
        approvedAt: bookedAt,
        now: new Date(bookedAt.getTime() + 25 * HOUR),
      }),
      // 55 hours before drop-off: inside the last 72 hours, so half the stay.
    ).toMatchObject({ rule: 'short_notice', fee: 102 });
  });

  it('counts a booking made exactly 72 hours ahead as made well ahead', () => {
    const bookedAt = hoursBefore(72);
    expect(
      decideCancellation({
        ...graced,
        bookedAt,
        approvedAt: bookedAt,
        now: new Date(bookedAt.getTime() + HOUR),
      }),
    ).toMatchObject({ rule: 'approval_grace', fee: 0 });
  });

  it('gives a last-minute booking no cooling-off', () => {
    const bookedAt = hoursBefore(60);
    expect(
      decideCancellation({
        ...graced,
        bookedAt,
        approvedAt: bookedAt,
        now: new Date(bookedAt.getTime() + 3 * HOUR),
      }),
    ).toMatchObject({ rule: 'short_notice', fee: 102 });
  });

  it('charges nothing when the approval time was never recorded', () => {
    expect(decideCancellation({ ...graced, approvedAt: null, now: hoursBefore(10) })).toEqual({
      allowed: true,
      rule: 'approval_time_unknown',
      fee: 0,
    });
  });
});

describe('decideCancellation under the older first-night terms', () => {
  const firstNight = { ...booking, schedule: 'first_night' as const };

  it('is free 72 hours or more ahead and one night after that', () => {
    expect(decideCancellation({ ...firstNight, now: hoursBefore(72) })).toEqual({
      allowed: true,
      rule: 'early',
      fee: 0,
    });
    expect(decideCancellation({ ...firstNight, now: hoursBefore(10) })).toEqual({
      allowed: true,
      rule: 'late',
      fee: 60,
    });
  });
});

describe('captureAmountFor', () => {
  it('charges the full price for a pet that checked in', () => {
    expect(captureAmountFor([{ price: 204, nightlyRate: 30, outcome: 'checked_in' }])).toBe(204);
  });

  it('charges half the stay for a no-show and nothing for a pet Wagstay could not take', () => {
    const pets = [
      { price: 120, nightlyRate: 30, outcome: 'checked_in' as const },
      { price: 84.35, nightlyRate: 30, outcome: 'no_show' as const },
      { price: 90, nightlyRate: 30, outcome: 'wagstay_unable' as const },
    ];
    expect(captureAmountFor(pets)).toBe(162.18);
    expect(captureAmountFor(pets, 'tiered_with_grace')).toBe(162.18);
  });

  it('charges the first night for a no-show under the older terms', () => {
    expect(
      captureAmountFor([{ price: 84.35, nightlyRate: 30, outcome: 'no_show' }], 'first_night'),
    ).toBe(30);
  });

  it('captures nothing when Wagstay could take no pet', () => {
    expect(captureAmountFor([{ price: 204, nightlyRate: 30, outcome: 'wagstay_unable' }])).toBe(0);
  });
});

describe('decideReschedule', () => {
  const request = {
    dropOffAt: DROP_OFF,
    now: hoursBefore(2),
    rescheduleCount: 0,
    dateChangeLimit: null,
    newStartDate: '2026-11-20',
    today: '2026-10-12',
  };

  it('lets the current terms change dates again and again before drop-off', () => {
    expect(decideReschedule(request)).toEqual({ allowed: true, usesFreeReschedule: false });
    expect(decideReschedule({ ...request, rescheduleCount: 5 })).toEqual({
      allowed: true,
      usesFreeReschedule: false,
    });
  });

  it('allows the older terms one free change, even inside the last 72 hours', () => {
    expect(decideReschedule({ ...request, dateChangeLimit: 1 })).toEqual({
      allowed: true,
      usesFreeReschedule: true,
    });
    expect(decideReschedule({ ...request, dateChangeLimit: 1, rescheduleCount: 1 })).toEqual({
      allowed: false,
      reason: 'no_free_reschedule_left',
    });
  });

  it('lets staff move a stay for an emergency without using the free change', () => {
    expect(
      decideReschedule({ ...request, dateChangeLimit: 1, rescheduleCount: 1, exception: true }),
    ).toEqual({ allowed: true, usesFreeReschedule: false });
  });

  it('refuses once the drop-off time has passed', () => {
    expect(decideReschedule({ ...request, now: DROP_OFF })).toEqual({
      allowed: false,
      reason: 'after_drop_off',
    });
  });

  it('keeps new dates within 12 months', () => {
    expect(decideReschedule({ ...request, newStartDate: '2027-10-12' })).toMatchObject({
      allowed: true,
    });
    expect(decideReschedule({ ...request, newStartDate: '2027-10-13' })).toEqual({
      allowed: false,
      reason: 'too_far_ahead',
    });
  });
});
