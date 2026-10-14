import { describe, expect, it } from 'vitest';
import { isInquiryNotesFilter, isInquirySupportStatusFilter, SUPPORT_STATUSES } from '../inquiry';

describe('isInquirySupportStatusFilter', () => {
  it('accepts "All"', () => {
    expect(isInquirySupportStatusFilter('All')).toBe(true);
  });

  it('accepts every value in SUPPORT_STATUSES', () => {
    for (const status of SUPPORT_STATUSES) {
      expect(isInquirySupportStatusFilter(status)).toBe(true);
    }
  });

  it('rejects an unrelated string', () => {
    expect(isInquirySupportStatusFilter('Nonsense')).toBe(false);
  });
});

describe('isInquiryNotesFilter', () => {
  it('accepts All, With notes, and No notes', () => {
    expect(isInquiryNotesFilter('All')).toBe(true);
    expect(isInquiryNotesFilter('With notes')).toBe(true);
    expect(isInquiryNotesFilter('No notes')).toBe(true);
  });

  it('rejects an unrelated string', () => {
    expect(isInquiryNotesFilter('Nonsense')).toBe(false);
  });
});
