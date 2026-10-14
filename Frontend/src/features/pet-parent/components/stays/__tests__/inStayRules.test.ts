import { describe, expect, it } from 'vitest';
import { aucklandInstantOf } from '../aucklandInstant';
import {
  aucklandClockOf,
  canAddOn,
  canChangeTimes,
  canExtendOnline,
  formatDayAndClock,
} from '../stayChangeRules';
import { bookedStay } from './stayFixtures';

/** 11:00 on Sun 13 Dec 2026 in Auckland: Biscuit's second day in. */
const DURING_STAY = new Date('2026-12-12T22:00:00Z');
/** An hour after the booked pick-up. */
const AFTER_PICK_UP = new Date('2026-12-15T04:00:00Z');
const BEFORE_DROP_OFF = new Date('2026-11-29T20:00:00Z');

const stayingNow = bookedStay({ status: 'staying_now', checkInOutcome: 'checked_in' });

describe('the changes a parent can make while the pet is staying', () => {
  it('offers more nights and an add-on once the pet is checked in', () => {
    expect(canExtendOnline(stayingNow, DURING_STAY)).toBe(true);
    expect(canAddOn(stayingNow, DURING_STAY)).toBe(true);
  });

  it.each([
    ['before the pet arrives', bookedStay(), BEFORE_DROP_OFF],
    ['once the pick-up time has passed', stayingNow, AFTER_PICK_UP],
    [
      'while the desk has not recorded the arrival',
      bookedStay({ status: 'staying_now' }),
      DURING_STAY,
    ],
    [
      'after a no-show',
      bookedStay({ status: 'staying_now', checkInOutcome: 'no_show' }),
      DURING_STAY,
    ],
    ['once the stay ended', bookedStay({ status: 'stay_ended' }), AFTER_PICK_UP],
  ])('offers none of them %s', (_label, stay, now) => {
    expect(canExtendOnline(stay, now)).toBe(false);
    expect(canAddOn(stay, now)).toBe(false);
  });
});

describe('when the drop-off or pick-up time can change', () => {
  it('allows it for an approved stay before drop-off and for a stay under way', () => {
    expect(canChangeTimes(bookedStay(), BEFORE_DROP_OFF)).toBe(true);
    expect(canChangeTimes(stayingNow, DURING_STAY)).toBe(true);
  });

  it('refuses it once the moment has passed, or for any other status', () => {
    expect(canChangeTimes(bookedStay(), DURING_STAY)).toBe(false);
    expect(canChangeTimes(stayingNow, AFTER_PICK_UP)).toBe(false);
    expect(canChangeTimes(bookedStay({ status: 'waiting_for_review' }), BEFORE_DROP_OFF)).toBe(
      false,
    );
    expect(canChangeTimes(bookedStay({ status: 'stay_ended' }), AFTER_PICK_UP)).toBe(false);
  });
});

describe('Auckland clock helpers', () => {
  it('reads the wall-clock time of an instant and writes it with its day', () => {
    expect(aucklandClockOf('2026-12-15T03:00:00.000Z')).toBe('16:00');
    expect(formatDayAndClock('2026-12-15T03:00:00.000Z')).toBe('Tue 15 Dec 16:00');
    expect(formatDayAndClock('2026-12-15T03:00:00.000Z', 'zh')).toBe('12月15日周二 16:00');
  });

  it('turns an Auckland day and time into the instant, in summer and in winter', () => {
    expect(aucklandInstantOf('2026-12-13', '11:00')).toBe('2026-12-12T22:00:00.000Z');
    expect(aucklandInstantOf('2026-07-01', '09:00')).toBe('2026-06-30T21:00:00.000Z');
  });
});
