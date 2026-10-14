import { describe, expect, it } from 'vitest';
import { createMockInquiries } from './inquiryFixtures';
import { CONVERSATION_STATUSES, SUPPORT_STATUSES } from '../types/inquiry';

describe('createMockInquiries', () => {
  it('assigns at least one Active and one Closed conversation to the given currentStaff', () => {
    const currentStaff = { id: 'staff-me', name: 'Me' };
    const inquiries = createMockInquiries(currentStaff);

    const mine = inquiries.filter((inquiry) => inquiry.assignee?.id === 'staff-me');
    expect(mine.some((inquiry) => inquiry.status === 'Active')).toBe(true);
    expect(mine.some((inquiry) => inquiry.status === 'Closed')).toBe(true);
  });

  it('falls back to a placeholder assignee when no currentStaff is given', () => {
    const withStaff = createMockInquiries({ id: 'staff-me', name: 'Me' });
    const withoutStaff = createMockInquiries(null);

    const assignedToMeCount = withStaff.filter(
      (inquiry) => inquiry.assignee?.id === 'staff-me',
    ).length;
    expect(assignedToMeCount).toBeGreaterThan(0);
    expect(withoutStaff.some((inquiry) => inquiry.assignee?.id === 'staff-me')).toBe(false);
  });

  it('covers every SupportStatus value across the seed set', () => {
    const inquiries = createMockInquiries({ id: 'staff-me', name: 'Me' });
    const statuses = new Set(inquiries.map((inquiry) => inquiry.supportStatus));
    for (const status of SUPPORT_STATUSES) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it('covers both ConversationStatus values across the seed set', () => {
    const inquiries = createMockInquiries({ id: 'staff-me', name: 'Me' });
    const statuses = new Set(inquiries.map((inquiry) => inquiry.status));
    for (const status of CONVERSATION_STATUSES) {
      expect(statuses.has(status)).toBe(true);
    }
  });
});
