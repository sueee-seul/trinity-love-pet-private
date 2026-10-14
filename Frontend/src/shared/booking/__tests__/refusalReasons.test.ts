import { describe, expect, it } from 'vitest';
import { REFUSAL_REASON_IDS, REFUSAL_REASONS, refusalReasonIn } from '../refusalReasons';

describe('refusal reasons', () => {
  it('translates every preset into Chinese', () => {
    REFUSAL_REASON_IDS.forEach((id) => {
      expect(refusalReasonIn(REFUSAL_REASONS.en[id], 'zh')).toBe(REFUSAL_REASONS.zh[id]);
    });
  });

  it('shows English as stored', () => {
    expect(refusalReasonIn('We are full that week.', 'en')).toBe('We are full that week.');
  });

  // Typed before the presets existed: there is nothing to translate it with.
  it('has no Chinese for words a manager typed', () => {
    expect(refusalReasonIn('We are full that week.', 'zh')).toBeNull();
  });
});
