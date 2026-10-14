import { describe, expect, it } from 'vitest';
import { formatStayDates } from '../liveCareDates';
import { defaultLiveCareStay, stayPhase } from '../liveCareStatus';
import type { StayStatus, PetStay } from '../../../types/stays';

const stayDays = { dropOffDate: '2026-09-27', pickUpDate: '2026-10-02' };

const DAY_MS = 24 * 60 * 60 * 1000;
// Only the id, the status the server sent and the two times matter to the pick, so the rest of
// the stay is left out.
const timedStay = (bookingPetId: string, from: number, to: number, status: StayStatus): PetStay =>
  ({
    bookingPetId,
    status,
    dropOffAt: new Date(Date.now() + from * DAY_MS).toISOString(),
    pickUpAt: new Date(Date.now() + to * DAY_MS).toISOString(),
  }) as PetStay;

describe('stayPhase without the booking times', () => {
  it('reads the calendar days of the live care response', () => {
    expect(stayPhase(stayDays, undefined, new Date(2026, 8, 26, 12))).toBe('upcoming');
    expect(stayPhase(stayDays, undefined, new Date(2026, 8, 27, 8))).toBe('in-progress');
    expect(stayPhase(stayDays, undefined, new Date(2026, 9, 2, 20))).toBe('in-progress');
    expect(stayPhase(stayDays, undefined, new Date(2026, 9, 3, 8))).toBe('ended');
  });
});

describe('stayPhase with the booking', () => {
  it('follows the status the server sent over the calendar days', () => {
    const duringTheStay = new Date(2026, 8, 28, 12);
    const phaseOf = (status: StayStatus): string =>
      stayPhase(stayDays, timedStay('bp', 0, 0, status), duringTheStay);

    expect(phaseOf('approved')).toBe('upcoming');
    expect(phaseOf('staying_now')).toBe('in-progress');
    expect(phaseOf('stay_ended')).toBe('ended');
  });
});

describe('formatStayDates', () => {
  it('writes the stay like the homepage does, in the viewer’s own calendar', () => {
    expect(formatStayDates('2026-09-27', '2026-10-02')).toBe('27 Sep to 2 Oct');
    expect(formatStayDates('2026-09-12', '2026-09-16')).toBe('12 to 16 Sep');
  });
});

describe('defaultLiveCareStay', () => {
  it('opens the stay under way that started last', () => {
    const stays = [
      timedStay('earlier-start', -3, 2, 'staying_now'),
      timedStay('later-start', -1, 4, 'staying_now'),
      timedStay('ended', -9, -5, 'stay_ended'),
    ];
    expect(defaultLiveCareStay(stays)?.bookingPetId).toBe('later-start');
  });

  it('opens the stay that ended last when none is under way, before any still to come', () => {
    const stays = [
      timedStay('soon', 2, 6, 'approved'),
      timedStay('long-ago', -40, -35, 'stay_ended'),
      timedStay('recent', -9, -5, 'stay_ended'),
    ];
    expect(defaultLiveCareStay(stays)?.bookingPetId).toBe('recent');
  });

  it('leaves the choice to the server when every stay is still to come', () => {
    expect(defaultLiveCareStay([timedStay('soon', 2, 6, 'approved')])).toBeNull();
    expect(defaultLiveCareStay([])).toBeNull();
  });

  it('skips requests the manager has not approved, whatever their dates', () => {
    const stays = [
      timedStay('pending-now', -1, 3, 'waiting_for_review'),
      timedStay('refused-now', -2, 3, 'refused'),
      timedStay('cancelled-past', -5, -3, 'cancelled'),
      timedStay('approved-past', -20, -15, 'stay_ended'),
    ];
    expect(defaultLiveCareStay(stays)?.bookingPetId).toBe('approved-past');
  });
});
