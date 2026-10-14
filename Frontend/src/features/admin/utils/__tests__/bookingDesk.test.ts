import { describe, expect, it } from 'vitest';
import { amountDueAtDesk, arrivalCanBeRecorded, isUnrecordedArrival } from '../bookingDesk';
import { cardBookingPet, cardBookingSecondPet } from '../../__tests__/bookingFixtures';

// The drop-off is 10:30 on Sat 12 Dec in Auckland, which is still Fri 11 Dec in UTC.
const FRIDAY_EVENING_IN_AUCKLAND = new Date('2026-12-11T06:00:00Z');
const DROP_OFF_MORNING = new Date('2026-12-11T19:00:00Z');
const NEXT_MORNING = new Date('2026-12-12T20:00:00Z');

describe('the desk rules the bookings page shows', () => {
  it('opens the desk on the Auckland drop-off day, not the UTC one', () => {
    const biscuit = cardBookingPet();

    expect(arrivalCanBeRecorded(biscuit, FRIDAY_EVENING_IN_AUCKLAND)).toBe(false);
    expect(arrivalCanBeRecorded(biscuit, DROP_OFF_MORNING)).toBe(true);
  });

  it('closes it once the booking is settled, and never opens it without a saved card', () => {
    const settled = cardBookingPet({
      booking: {
        card_guarantee: {
          status: 'succeeded',
          amount: 460,
          captured_amount: 345,
          test_mode: false,
          pays_at_request: false,
        },
      },
    });

    expect(arrivalCanBeRecorded(settled, NEXT_MORNING)).toBe(false);
    expect(
      arrivalCanBeRecorded(cardBookingPet({ booking: { card_guarantee: null } }), NEXT_MORNING),
    ).toBe(false);
  });

  it('lists an arrival as unrecorded from the day after drop-off', () => {
    expect(isUnrecordedArrival(cardBookingPet(), DROP_OFF_MORNING)).toBe(false);
    expect(isUnrecordedArrival(cardBookingPet(), NEXT_MORNING)).toBe(true);
    expect(
      isUnrecordedArrival(
        cardBookingPet({ booking: { check_in_outcome: 'no_show' } }),
        NEXT_MORNING,
      ),
    ).toBe(false);
  });

  it.each([
    ['both checked in', 'checked_in', 'checked_in', 460],
    // A no-show costs its first night ($60), as the server charges it, never half the stay.
    ['one checked in, one no-show', 'checked_in', 'no_show', 290],
    ['one no-show, one we could not take', 'no_show', 'wagstay_unable', 60],
    ['neither taken', 'wagstay_unable', 'wagstay_unable', 0],
  ] as const)('charges what the server will for %s', (_label, first, second, amount) => {
    expect(
      amountDueAtDesk([
        cardBookingPet({ booking: { check_in_outcome: first } }),
        cardBookingSecondPet({ check_in_outcome: second }),
      ]),
    ).toBe(amount);
  });

  it('waits for every pet still on the booking, and ignores a refused one', () => {
    const biscuit = cardBookingPet({ booking: { check_in_outcome: 'checked_in' } });

    expect(amountDueAtDesk([biscuit, cardBookingSecondPet()])).toBeNull();
    expect(
      amountDueAtDesk([biscuit, cardBookingSecondPet({ manager_review_status: 'refused' })]),
    ).toBe(230);
  });

  it('never charges more than the card holds', () => {
    expect(
      amountDueAtDesk([
        cardBookingPet({
          booking: {
            check_in_outcome: 'checked_in',
            pet_price: 500,
            card_guarantee: {
              status: 'authorized',
              amount: 460,
              captured_amount: null,
              test_mode: false,
              pays_at_request: false,
            },
          },
        }),
      ]),
    ).toBe(460);
  });

  describe('a stay paid at request', () => {
    const paid = {
      status: 'succeeded' as const,
      amount: 460,
      captured_amount: null,
      test_mode: false,
      pays_at_request: true,
    };

    it('keeps the desk open after the charge on confirmation', () => {
      expect(
        arrivalCanBeRecorded(
          cardBookingPet({ booking: { card_guarantee: paid } }),
          DROP_OFF_MORNING,
        ),
      ).toBe(true);
    });

    it('counts a no-show as half its stay, as the server does under these terms', () => {
      expect(
        amountDueAtDesk([
          cardBookingPet({ booking: { check_in_outcome: 'checked_in', card_guarantee: paid } }),
          cardBookingSecondPet({ check_in_outcome: 'no_show', card_guarantee: paid }),
        ]),
        // $230 + half of $230.
      ).toBe(345);
    });
  });
});
