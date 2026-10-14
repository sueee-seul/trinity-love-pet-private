import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/bookingApi';
import {
  apiErrorCode,
  aucklandDateOf,
  bookingHasArrivalOutcome,
  canCancelOnline,
  canMoveOnline,
  changedAmountOf,
  earliestNewDropOff,
  formatDay,
  fullNightsOf,
  latestPickUpFor,
  listOfNames,
} from '../stayChangeRules';
import { bookedStay } from './stayFixtures';

const BEFORE_DROP_OFF = new Date('2026-11-29T20:00:00Z');
const AFTER_DROP_OFF = new Date('2026-12-12T00:00:00Z');

describe('when a guest can change a stay online', () => {
  it('offers both changes before drop-off, on a booking made with a saved card', () => {
    expect(canCancelOnline(bookedStay(), BEFORE_DROP_OFF)).toBe(true);
    expect(canMoveOnline(bookedStay(), BEFORE_DROP_OFF)).toBe(true);
  });

  it('offers both changes on a stay paid at request, before anything is settled', () => {
    const paid = bookedStay({
      card: {
        status: 'succeeded',
        amount: 460,
        capturedAmount: null,
        testMode: true,
        paysAtRequest: true,
      },
    });

    expect(canCancelOnline(paid, BEFORE_DROP_OFF)).toBe(true);
    expect(canMoveOnline(paid, BEFORE_DROP_OFF)).toBe(true);
  });

  it('lets a request still waiting for review be withdrawn', () => {
    const request = bookedStay({ status: 'waiting_for_review', reviewStatus: 'pending' });

    expect(canCancelOnline(request, BEFORE_DROP_OFF)).toBe(true);
  });

  it.each([
    ['after drop-off', bookedStay(), AFTER_DROP_OFF],
    ['once cancelled', bookedStay({ status: 'cancelled' }), BEFORE_DROP_OFF],
    ['once refused', bookedStay({ status: 'refused' }), BEFORE_DROP_OFF],
    ['without a saved card', bookedStay({ card: null }), BEFORE_DROP_OFF],
    [
      'once settled',
      bookedStay({
        card: {
          status: 'canceled',
          amount: 460,
          capturedAmount: 0,
          testMode: false,
          paysAtRequest: false,
        },
      }),
      BEFORE_DROP_OFF,
    ],
  ])('offers neither %s', (_label, stay, now) => {
    expect(canCancelOnline(stay, now)).toBe(false);
    expect(canMoveOnline(stay, now)).toBe(false);
  });

  it('offers cancelling but not moving once no date change is left or the card was refused', () => {
    const moved = bookedStay({ dateChangesLeft: 0 });
    const refused = bookedStay({
      card: {
        status: 'failed',
        amount: 460,
        capturedAmount: null,
        testMode: false,
        paysAtRequest: false,
      },
    });

    expect([
      canCancelOnline(moved, BEFORE_DROP_OFF),
      canMoveOnline(moved, BEFORE_DROP_OFF),
    ]).toEqual([true, false]);
    expect(canMoveOnline(refused, BEFORE_DROP_OFF)).toBe(false);
  });
});

describe('the words the stay dialogs use', () => {
  it('reads dates in Auckland and names pets in a list', () => {
    expect(aucklandDateOf('2026-12-11T21:30:00.000Z')).toBe('2026-12-12');
    expect(formatDay('2026-12-12')).toBe('Sat 12 Dec');
    expect(listOfNames(['Biscuit', 'Mochi', 'Rex'])).toBe('Biscuit, Mochi and Rex');
  });

  it('joins names the Chinese way when the site is in Chinese', () => {
    expect(listOfNames(['Biscuit'], 'zh')).toBe('Biscuit');
    expect(listOfNames(['Biscuit', 'Mochi'], 'zh')).toBe('Biscuit 和 Mochi');
    expect(listOfNames(['Biscuit', 'Mochi', 'Rex'], 'zh')).toBe('Biscuit、Mochi 和 Rex');
  });

  it('finds the full nights in a fully booked refusal, and nothing in any other', () => {
    const full = new ApiError('Some of those nights are fully booked.', 409, {
      error: { code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-12-20' }] },
    });

    expect(fullNightsOf(full)).toEqual(['2026-12-20']);
    expect(fullNightsOf(new ApiError('Nope', 409, { error: { code: 'RESCHEDULE_USED' } }))).toEqual(
      [],
    );
    expect(fullNightsOf(new Error('offline'))).toEqual([]);
  });
});

describe('the bounds the date picker shares with the server', () => {
  it('allows a drop-off today only while the booked drop-off time is still ahead', () => {
    // Biscuit is dropped off at 10:30 Auckland time. At 09:00 today still works; at 11:00 not.
    expect(earliestNewDropOff(bookedStay(), new Date('2026-11-29T20:00:00Z'))).toBe('2026-11-30');
    expect(earliestNewDropOff(bookedStay(), new Date('2026-11-29T22:00:00Z'))).toBe('2026-12-01');
  });

  it('stops the pick-up at the longest stay the server prices', () => {
    expect(latestPickUpFor('2026-12-19')).toBe('2027-02-17');
  });
});

describe('a booking already at the desk', () => {
  it('has an arrival outcome for every pet on it once any pet has one', () => {
    const biscuit = bookedStay();
    const mochi = bookedStay({ bookingPetId: 'bp-mochi', checkInOutcome: 'checked_in' });
    const other = bookedStay({ bookingPetId: 'bp-rex', bookingId: 'booking-2' });

    expect(bookingHasArrivalOutcome(biscuit, [biscuit, mochi, other])).toBe(true);
    expect(bookingHasArrivalOutcome(other, [biscuit, mochi, other])).toBe(false);
  });
});

describe('a "changed since you checked" refusal', () => {
  it('carries its code and the new amount', () => {
    const changed = new ApiError('The fee changed.', 409, {
      error: { code: 'CANCELLATION_FEE_CHANGED', details: [{ amount: 120 }] },
    });

    expect(apiErrorCode(changed)).toBe('CANCELLATION_FEE_CHANGED');
    expect(changedAmountOf(changed)).toBe(120);
    expect(apiErrorCode(new Error('offline'))).toBeNull();
    expect(
      changedAmountOf(new ApiError('Nope', 409, { error: { code: 'BOOKING_STARTED' } })),
    ).toBeNull();
  });
});
