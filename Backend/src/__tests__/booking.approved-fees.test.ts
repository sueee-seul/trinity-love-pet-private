import { describe, expect, it } from 'vitest';
import { captureAmountFor, decideCancellation, lateFee } from '../services/booking.fee-policy.js';

const dropOffAt = new Date('2026-12-12T00:00:00Z');
const before = (hours: number): Date => new Date(dropOffAt.getTime() - hours * 3_600_000);
// The older terms' rules, which bookings agreed under them keep.
const request = {
  schedule: 'first_night' as const,
  total: 230,
  nightlyRate: 60,
  bookedAt: before(240),
  approvedAt: before(100),
  dropOffAt,
  now: before(30),
};

describe('approved first-night policy (older terms)', () => {
  it('excludes flat extras and caps the fee at the pet total', () => {
    expect(lateFee(230, 60)).toBe(60);
    expect(lateFee(40, 60)).toBe(40);
    expect(lateFee(230, 0)).toBe(0);
  });
  it('does not charge a stay approved before approval times were recorded', () => {
    expect(decideCancellation({ ...request, approvedAt: null })).toMatchObject({
      allowed: true,
      rule: 'approval_time_unknown',
      fee: 0,
    });
  });
  it('allows two hours from approval, including the boundary', () => {
    expect(decideCancellation({ ...request, approvedAt: before(32) })).toMatchObject({
      rule: 'approval_grace',
      fee: 0,
    });
    expect(decideCancellation({ ...request, approvedAt: before(32.001) })).toMatchObject({
      rule: 'late',
      fee: 60,
    });
  });
  it('counts cooling-off from approval, not submission', () => {
    expect(
      decideCancellation({ ...request, approvedAt: before(80), now: before(56) }),
    ).toMatchObject({ rule: 'cooling_off', fee: 0 });
  });
  it('does not allow cancellation at drop-off', () => {
    expect(decideCancellation({ ...request, now: dropOffAt })).toEqual({
      allowed: false,
      reason: 'after_drop_off',
    });
  });
  it('charges the first night for a no-show and full price for an arrival', () => {
    expect(
      captureAmountFor(
        [
          { price: 230, nightlyRate: 60, outcome: 'no_show' },
          { price: 150, nightlyRate: 50, outcome: 'checked_in' },
        ],
        'first_night',
      ),
    ).toBe(210);
  });
});
