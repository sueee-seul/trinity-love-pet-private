import { describe, expect, it } from 'vitest';
import { cardBookingPet } from '../../__tests__/bookingFixtures';
import type { ManagerBookingRecord, ManagerReviewStatus } from '../../types/booking';
import { daysUntilCheckIn, isUrgentReview, orderBookingsForTab } from '../bookingOrder';

/* 13:00 on Thu 1 Oct 2026 in Auckland (NZDT). */
const NOW = new Date('2026-10-01T00:00:00Z');

const stay = (
  id: string,
  checkIn: string | null,
  status: ManagerReviewStatus = 'pending',
): ManagerBookingRecord =>
  cardBookingPet({
    booking_pets_uuid: `bp-${id}`,
    booking_id: `booking-${id}`,
    booking: {
      dates: { check_in: checkIn, check_out: null },
      manager_review_status: status,
    },
  });

const order = (records: ManagerBookingRecord[], tab: 'Booking' | 'Approve' | 'Refuse'): string[] =>
  orderBookingsForTab(records, tab, NOW).map((record) => record.booking_id);

describe('booking order', () => {
  it('lists upcoming check-ins soonest first, then past ones newest first, then no date', () => {
    const records = [
      stay('no-date', null),
      stay('past-old', '2026-09-20'),
      stay('later', '2026-10-20'),
      stay('past-recent', '2026-09-29'),
      stay('today', '2026-10-01'),
      stay('soon', '2026-10-03'),
    ];

    expect(order(records, 'Booking')).toEqual([
      'booking-today',
      'booking-soon',
      'booking-later',
      'booking-past-recent',
      'booking-past-old',
      'booking-no-date',
    ]);
    expect(order(records, 'Approve')[0]).toBe('booking-today');
  });

  it('keeps the loaded order on the other tabs', () => {
    const records = [stay('later', '2026-10-20'), stay('soon', '2026-10-03')];

    expect(order(records, 'Refuse')).toEqual(['booking-later', 'booking-soon']);
  });

  it('keeps pets of one booking together', () => {
    const first = stay('a', '2026-10-05');
    const second = { ...stay('a', '2026-10-05'), booking_pets_uuid: 'bp-a-2' };
    const other = stay('b', '2026-10-05');

    expect(
      orderBookingsForTab([first, other, second], 'Booking', NOW).map(
        (record) => record.booking_pets_uuid,
      ),
    ).toEqual(['bp-a', 'bp-a-2', 'bp-b']);
  });

  it('counts days to check-in in Auckland dates', () => {
    expect(daysUntilCheckIn(stay('x', '2026-10-04'), NOW)).toBe(3);
    expect(daysUntilCheckIn(stay('x', '2026-09-30'), NOW)).toBe(-1);
    expect(daysUntilCheckIn(stay('x', null), NOW)).toBeNull();
  });

  it('marks a review urgent up to 3 days before check-in, and after it has passed', () => {
    expect(isUrgentReview(stay('x', '2026-10-04'), NOW)).toBe(true);
    expect(isUrgentReview(stay('x', '2026-10-05'), NOW)).toBe(false);
    expect(isUrgentReview(stay('x', '2026-09-30'), NOW)).toBe(true);
    expect(isUrgentReview(stay('x', '2026-10-02', 'approved'), NOW)).toBe(false);
    expect(isUrgentReview(stay('x', null), NOW)).toBe(false);
  });
});
