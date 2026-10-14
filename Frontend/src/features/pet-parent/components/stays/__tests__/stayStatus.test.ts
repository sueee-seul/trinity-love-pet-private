import { describe, expect, it } from 'vitest';
import type { StayStatus, PetStay } from '../../../types/stays';
import { canViewCare, hasBoardingPass, stayTab } from '../stayStatus';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const at = (hoursFromNow: number): string => new Date(NOW + hoursFromNow * HOUR_MS).toISOString();

const stay = (
  status: StayStatus,
  dropOffHours: number,
  pickUpHours: number,
): Pick<PetStay, 'status' | 'dropOffAt' | 'pickUpAt'> => ({
  status,
  dropOffAt: at(dropOffHours),
  pickUpAt: at(pickUpHours),
});

describe('stayTab', () => {
  it('keeps an approved stay in Upcoming until it ends', () => {
    expect(stayTab(stay('approved', 48, 96), NOW)).toBe('upcoming');
    expect(stayTab(stay('staying_now', -24, 24), NOW)).toBe('upcoming');
    expect(stayTab(stay('stay_ended', -96, -48), NOW)).toBe('past');
  });

  it('keeps a request waiting for review in Upcoming until its pick-up passes', () => {
    expect(stayTab(stay('waiting_for_review', 48, 96), NOW)).toBe('upcoming');
    expect(stayTab(stay('waiting_for_review', -24, 24), NOW)).toBe('upcoming');
    expect(stayTab(stay('waiting_for_review', -48, 0), NOW)).toBe('upcoming');
  });

  it('moves a request never reviewed to Past once its dates are over', () => {
    expect(stayTab(stay('waiting_for_review', -96, -1), NOW)).toBe('past');
  });

  it('moves a stay the desk recorded as a no-show to Past, even before its pick-up', () => {
    expect(stayTab(stay('did_not_arrive', -2, 48), NOW)).toBe('past');
  });

  it.each(['refused', 'cancelled'] as const)(
    'shows a %s request in Upcoming only while its drop-off is ahead',
    (status) => {
      expect(stayTab(stay(status, 1, 48), NOW)).toBe('upcoming');
      expect(stayTab(stay(status, 0, 48), NOW)).toBe('past');
      expect(stayTab(stay(status, -96, -48), NOW)).toBe('past');
    },
  );
});

describe('canViewCare', () => {
  it('opens live care only for an approved stay that has started', () => {
    expect(canViewCare({ status: 'staying_now' })).toBe(true);
    expect(canViewCare({ status: 'stay_ended' })).toBe(true);
    for (const status of [
      'approved',
      'waiting_for_review',
      'did_not_arrive',
      'refused',
      'cancelled',
    ] as const) {
      expect(canViewCare({ status })).toBe(false);
    }
  });
});

describe('hasBoardingPass', () => {
  it.each(['approved', 'staying_now', 'stay_ended'] as const)(
    'gives a %s stay a boarding pass, since the manager approved it',
    (status) => {
      expect(hasBoardingPass({ status })).toBe(true);
    },
  );

  it.each(['waiting_for_review', 'refused', 'cancelled'] as const)(
    'never gives a %s request a boarding pass',
    (status) => {
      expect(hasBoardingPass({ status })).toBe(false);
    },
  );
});
