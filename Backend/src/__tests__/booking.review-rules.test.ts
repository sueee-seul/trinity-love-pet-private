import { describe, expect, it } from 'vitest';
import { REVIEW_REASON_WORDS, managerReviewReasons } from '../services/booking.review-rules.js';

describe('which stays a manager checks first', () => {
  it('confirms a pet without medication at once, however long or new', () => {
    expect(managerReviewReasons({ needsMedication: false })).toEqual([]);
  });

  it('sends a pet that takes medication to the manager', () => {
    expect(managerReviewReasons({ needsMedication: true })).toEqual(['medication']);
  });

  it('names the reason in a notice', () => {
    expect(REVIEW_REASON_WORDS).toEqual({ medication: 'takes medication' });
  });
});
