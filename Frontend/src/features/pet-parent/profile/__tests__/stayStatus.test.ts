import { describe, expect, it } from 'vitest';
import type { StayStatus } from '../../types/stays';
import { isCurrentOrUpcoming } from '../stayStatus';
import type { Stay } from '../types';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (daysFromNow: number): string => new Date(NOW + daysFromNow * DAY_MS).toISOString();

const stay = (status: StayStatus, startDays: number, endDays: number): Stay => ({
  id: `stay-${status}`,
  petId: 'pet-1',
  facilityId: '',
  type: 'BOARDING',
  status,
  startAt: at(startDays),
  endAt: at(endDays),
});

describe('isCurrentOrUpcoming', () => {
  it('counts a stay under way, an approved stay and a request still waiting for review', () => {
    expect(isCurrentOrUpcoming(stay('staying_now', -1, 1), NOW)).toBe(true);
    expect(isCurrentOrUpcoming(stay('approved', 3, 5), NOW)).toBe(true);
    expect(isCurrentOrUpcoming(stay('waiting_for_review', 3, 5), NOW)).toBe(true);
  });

  it('never offers a request whose dates passed while it waited as the next stay', () => {
    expect(isCurrentOrUpcoming(stay('waiting_for_review', -5, -3), NOW)).toBe(false);
  });

  it('never offers an ended stay or a refused or cancelled request as the next stay', () => {
    expect(isCurrentOrUpcoming(stay('stay_ended', -5, -3), NOW)).toBe(false);
    expect(isCurrentOrUpcoming(stay('refused', 3, 5), NOW)).toBe(false);
    expect(isCurrentOrUpcoming(stay('cancelled', 3, 5), NOW)).toBe(false);
  });
});
