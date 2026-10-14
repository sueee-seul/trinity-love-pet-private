import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInquiriesPage } from '../pages/AdminInquiriesPage';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { useInquiryStore } from '../store/inquiryStore';
import type { InquiryConversation } from '../types/inquiry';
import type { StaffMember } from '../types/staff';

vi.mock('../api/staffApi', () => ({
  StaffApiError: class StaffApiError extends Error {
    public readonly status = 500;
  },
  fetchStaffList: vi.fn().mockResolvedValue([]),
  fetchStaffManagementOptions: vi.fn().mockResolvedValue({ facilities: [], employmentTypes: [] }),
  createStaffMember: vi.fn(),
  updateStaffMember: vi.fn(),
  deleteStaffMember: vi.fn(),
}));

function makeInquiry(overrides: Partial<InquiryConversation>): InquiryConversation {
  return {
    uuid: 'inq',
    parentName: 'Parent',
    parentInitials: 'P',
    petName: 'Pet',
    topic: 'Topic',
    topicCategory: 'General',
    startedAt: '2026-06-15T10:00:00.000Z',
    durationMinutes: 10,
    status: 'Active',
    supportStatus: 'AI Handling',
    supportRequestedAt: null,
    assignee: null,
    notes: '',
    aiSummary: 'Summary',
    aiDetectedTopic: 'General',
    aiEscalationReason: null,
    aiRelevantInfo: 'Info',
    messages: [],
    ...overrides,
  };
}

const FIXTURE: InquiryConversation[] = [
  makeInquiry({
    uuid: 'mine',
    parentName: 'Assigned To Me',
    assignee: { id: 'staff-1', name: 'Alice' },
  }),
  makeInquiry({
    uuid: 'theirs',
    parentName: 'Assigned To Bob',
    assignee: { id: 'staff-2', name: 'Bob' },
  }),
  makeInquiry({ uuid: 'unassigned', parentName: 'Nobody Yet', assignee: null }),
];

function makeStaff(overrides: Partial<StaffMember>): StaffMember {
  return {
    id: 'staff-1',
    name: 'Alice',
    username: 'alice',
    email: 'alice@wagstay.com',
    phone: null,
    employee_role: 'staff',
    status: 'active',
    employeeNumber: 'WS-0001',
    joinedDate: '01/01/2026',
    avatarUrl: null,
    facilityUuid: 'facility-1',
    facilityName: 'Central',
    employmentType: 'full-time',
    title: null,
    shiftDetails: null,
    ...overrides,
  };
}

beforeEach(() => {
  useInquiryStore.getState().hydrateInquirySnapshot(FIXTURE, new Map());
  useInquiryStore.setState({ openConversationUuid: null, isPanelMinimized: false });
});

describe('Inquiries role scoping (integration)', () => {
  it('a manager sees every conversation and the manager-only controls', async () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ employee_role: 'manager' }) });
    render(<AdminInquiriesPage />);

    await screen.findByRole('table');

    expect(screen.getByText('Assigned To Me')).toBeInTheDocument();
    expect(screen.getByText('Assigned To Bob')).toBeInTheDocument();
    expect(screen.getByText('Nobody Yet')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by assignee' })).toBeInTheDocument();
    expect(
      screen.queryByText("You're seeing conversations assigned to you."),
    ).not.toBeInTheDocument();
  });

  it('a staff member sees only their own conversations and the assigned-to-you banner', async () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ id: 'staff-1', employee_role: 'staff' }) });
    render(<AdminInquiriesPage />);

    await screen.findByRole('table');

    expect(screen.getByText('Assigned To Me')).toBeInTheDocument();
    expect(screen.queryByText('Assigned To Bob')).not.toBeInTheDocument();
    expect(screen.queryByText('Nobody Yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Filter by assignee' })).not.toBeInTheDocument();
    expect(screen.getByText("You're seeing conversations assigned to you.")).toBeInTheDocument();
  });
});
