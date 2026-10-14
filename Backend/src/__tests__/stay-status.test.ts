import { describe, expect, it } from 'vitest';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import {
  STAY_STATUS_LABELS,
  hasLiveCare,
  isOpenRequest,
  refusalReasonFor,
  toStayStatus,
  type ReviewedStay,
  reviewerNameFor,
} from '../services/stay-status.js';

const DROP_OFF = new Date('2026-10-12T09:00:00.000Z');
const PICK_UP = new Date('2026-10-14T17:00:00.000Z');
const BEFORE = new Date('2026-10-01T00:00:00.000Z');
const DURING = new Date('2026-10-13T12:00:00.000Z');
const AFTER = new Date('2026-10-20T00:00:00.000Z');

const stay = (
  reviewStatus: ManagerReviewStatus,
  overrides: Partial<ReviewedStay> = {},
): ReviewedStay => ({
  reviewStatus,
  checkInOutcome: null,
  dropOffTime: DROP_OFF,
  pickUpTime: PICK_UP,
  ...overrides,
});

describe('toStayStatus', () => {
  it.each([
    ['before', BEFORE],
    ['during', DURING],
    ['after', AFTER],
  ])('names the manager decision alone %s the stay', (_when, now) => {
    expect(toStayStatus(stay('pending'), now)).toBe('waiting_for_review');
    expect(toStayStatus(stay('refused'), now)).toBe('refused');
    expect(toStayStatus(stay('cancelled'), now)).toBe('cancelled');
  });

  it('follows the clock once the manager approved the stay', () => {
    expect(toStayStatus(stay('approved'), BEFORE)).toBe('approved');
    expect(toStayStatus(stay('approved'), DURING)).toBe('staying_now');
    expect(toStayStatus(stay('approved'), AFTER)).toBe('stay_ended');
  });

  it('counts drop-off and pick-up themselves as part of the stay', () => {
    const justBeforeDropOff = new Date(DROP_OFF.getTime() - 1);
    const justAfterPickUp = new Date(PICK_UP.getTime() + 1);

    expect(toStayStatus(stay('approved'), justBeforeDropOff)).toBe('approved');
    expect(toStayStatus(stay('approved'), DROP_OFF)).toBe('staying_now');
    expect(toStayStatus(stay('approved'), PICK_UP)).toBe('staying_now');
    expect(toStayStatus(stay('approved'), justAfterPickUp)).toBe('stay_ended');
  });

  it('reads a missing drop-off as not started and a missing pick-up as not ended', () => {
    expect(toStayStatus(stay('approved', { dropOffTime: null }), AFTER)).toBe('approved');
    expect(toStayStatus(stay('approved', { pickUpTime: null }), AFTER)).toBe('staying_now');
  });

  it('follows what the desk recorded on arrival', () => {
    const recorded = (checkInOutcome: ReviewedStay['checkInOutcome']): ReviewedStay =>
      stay('approved', { checkInOutcome });
    const earlyOnDropOffDay = new Date(DROP_OFF.getTime() - 60 * 60 * 1000);

    // Checked in before the booked time that day: staying, not still "confirmed".
    expect(toStayStatus(recorded('checked_in'), earlyOnDropOffDay)).toBe('staying_now');
    expect(toStayStatus(recorded('checked_in'), AFTER)).toBe('stay_ended');
    // A no-show never reads as staying or ended, and a pet Wagstay could not take was not accepted.
    expect(toStayStatus(recorded('no_show'), DURING)).toBe('did_not_arrive');
    expect(toStayStatus(recorded('no_show'), AFTER)).toBe('did_not_arrive');
    expect(toStayStatus(recorded('wagstay_unable'), DURING)).toBe('refused');
  });

  it('fails loudly on a review status the database should never hold', () => {
    const unknown = { ...stay('approved'), reviewStatus: 'paid' } as unknown as ReviewedStay;
    expect(() => toStayStatus(unknown, DURING)).toThrow('Unknown manager review status');
  });
});

describe('review status helpers', () => {
  it('treats only pending and approved requests as still standing', () => {
    expect(isOpenRequest('pending')).toBe(true);
    expect(isOpenRequest('approved')).toBe(true);
    expect(isOpenRequest('refused')).toBe(false);
    expect(isOpenRequest('cancelled')).toBe(false);
  });

  it('gives live care only to approved stays', () => {
    expect(hasLiveCare('approved')).toBe(true);
    expect(hasLiveCare('pending')).toBe(false);
    expect(hasLiveCare('refused')).toBe(false);
    expect(hasLiveCare('cancelled')).toBe(false);
  });

  it('shares the refusal reason only while the request stands refused', () => {
    expect(refusalReasonFor('refused', '  Fully booked that week  ')).toBe(
      'Fully booked that week',
    );
    expect(refusalReasonFor('refused', '   ')).toBeNull();
    expect(refusalReasonFor('refused', null)).toBeNull();
    expect(refusalReasonFor('approved', 'Old reason')).toBeNull();
    expect(refusalReasonFor('cancelled', 'Old reason')).toBeNull();
  });

  it('words every status in sentence case', () => {
    expect(STAY_STATUS_LABELS).toEqual({
      waiting_for_review: 'Waiting for review',
      approved: 'Confirmed',
      staying_now: 'Staying now',
      stay_ended: 'Stay ended',
      did_not_arrive: 'Did not arrive',
      refused: 'Not accepted',
      cancelled: 'Cancelled',
    });
  });
});

describe('reviewerNameFor', () => {
  it('names the manager by first name while their decision stands', () => {
    expect(reviewerNameFor('approved', 'Mere Walker')).toBe('Mere');
    expect(reviewerNameFor('refused', '  James  Chen ')).toBe('James');
  });

  it('names nobody when no manager decision stands', () => {
    expect(reviewerNameFor('pending', 'Mere Walker')).toBeNull();
    expect(reviewerNameFor('cancelled', 'Mere Walker')).toBeNull();
    expect(reviewerNameFor('approved', null)).toBeNull();
    expect(reviewerNameFor('approved', '   ')).toBeNull();
  });
});
