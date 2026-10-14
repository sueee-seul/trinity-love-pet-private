import { describe, expect, it } from 'vitest';
import { mapInquiry, type StaffDirectoryEntry } from '../inquiryApi';

function baseApiInquiry(
  messages: Parameters<typeof mapInquiry>[0]['messages'],
): Parameters<typeof mapInquiry>[0] {
  return {
    uuid: 'conv-1',
    pet_owners_uuid: 'owner-1',
    parent_first_name: 'Sarah',
    parent_last_name: 'Nguyen',
    pet_uuid: null,
    pet_name: null,
    status: 'active' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_staff_uuid: null,
    ai_summary: null,
    employee_notes: null,
    support_status: 'support_handling' as const,
    messages,
  };
}

describe('mapInquiry - staff message author resolution', () => {
  it("uses the message's own stored display name, without needing the staff directory", () => {
    const inquiry = baseApiInquiry([
      {
        uuid: 'm1',
        created_at: new Date().toISOString(),
        sender_role: 'staff',
        topic: null,
        body: 'Hi, how can I help?',
        employees_uuid: 'staff-uuid-1',
        employees_display_name: 'Tom Reilly',
      },
    ]);

    const result = mapInquiry(inquiry, new Map());

    expect(result.messages[0].authorName).toBe('Tom Reilly');
  });

  it('falls back to the staff directory for an older message with no stored display name', () => {
    const inquiry = baseApiInquiry([
      {
        uuid: 'm1',
        created_at: new Date().toISOString(),
        sender_role: 'staff',
        topic: null,
        body: 'Hi, how can I help?',
        employees_uuid: 'staff-uuid-1',
        employees_display_name: null,
      },
    ]);
    const staffDirectoryByUuid = new Map<string, StaffDirectoryEntry>([
      ['staff-uuid-1', { name: 'Aroha Ngata', role: 'staff' }],
    ]);

    const result = mapInquiry(inquiry, staffDirectoryByUuid);

    expect(result.messages[0].authorName).toBe('Aroha Ngata');
  });

  it('falls back to "Staff" when neither the message nor the directory has a name', () => {
    const inquiry = baseApiInquiry([
      {
        uuid: 'm1',
        created_at: new Date().toISOString(),
        sender_role: 'staff',
        topic: null,
        body: 'Hi, how can I help?',
        employees_uuid: 'staff-uuid-1',
        employees_display_name: null,
      },
    ]);

    const result = mapInquiry(inquiry, new Map());

    expect(result.messages[0].authorName).toBe('Staff');
  });
});
