import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { useInquiryStore } from '../../store/inquiryStore';
import type { InquiryConversation } from '../../types/inquiry';
import type { StaffMember } from '../../types/staff';
import { useAdminInquiryData } from '../useAdminInquiryData';

// `useAdminInquiryData` calls `useAdminInquirySnapshot` internally, which now
// fetches over the network - every test here seeds the store directly, so
// these calls must not be allowed to hit a real (absent) backend.
vi.mock('../../api/inquiryApi', () => ({
  fetchInquiries: vi.fn().mockResolvedValue([]),
  assignStaffOnServer: vi.fn().mockResolvedValue(undefined),
  resolveInquiryOnServer: vi.fn().mockResolvedValue(undefined),
  saveNotesOnServer: vi.fn().mockResolvedValue(undefined),
  sendStaffMessageOnServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../api/staffApi', () => ({
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

const FIXTURE: InquiryConversation[] = [
  makeInquiry({ uuid: 'a1', status: 'Active', assignee: { id: 'staff-1', name: 'Alice' } }),
  makeInquiry({ uuid: 'a2', status: 'Active', assignee: { id: 'staff-2', name: 'Bob' } }),
  makeInquiry({ uuid: 'c1', status: 'Closed', assignee: { id: 'staff-1', name: 'Alice' } }),
  makeInquiry({ uuid: 'c2', status: 'Closed', assignee: null }),
];

function seed(): void {
  useInquiryStore.getState().hydrateInquirySnapshot(FIXTURE, new Map());
}

const BASE_QUERY = {
  tab: 'Active' as const,
  searchQuery: '',
  supportStatusFilter: 'All' as const,
  dateFrom: '',
  dateTo: '',
  assigneeId: 'All',
  parentNameQuery: '',
  topicQuery: '',
  durationMin: null,
  durationMax: null,
  notesFilter: 'All' as const,
  sort: { field: 'startedAt' as const, direction: 'desc' as const },
};

beforeEach(() => {
  useInquiryStore.setState({
    inquiryByUuid: {},
    inquiryUuids: [],
    snapshotStatus: 'idle',
    snapshotError: null,
  });
  useCurrentStaffStore.getState().clear();
  seed();
});

describe('useAdminInquiryData - role scoping', () => {
  it('a manager sees every inquiry regardless of assignee', () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ employee_role: 'manager' }) });
    const { result } = renderHook(() => useAdminInquiryData(BASE_QUERY));

    expect(result.current.isManager).toBe(true);
    expect(result.current.inquiries.map((inquiry) => inquiry.uuid).sort()).toEqual(['a1', 'a2']);
    expect(result.current.counts).toEqual({ active: 2, closed: 2 });
  });

  it('a staff member sees only inquiries assigned to them', () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ id: 'staff-1', employee_role: 'staff' }) });
    const { result } = renderHook(() => useAdminInquiryData(BASE_QUERY));

    expect(result.current.isManager).toBe(false);
    expect(result.current.inquiries.map((inquiry) => inquiry.uuid)).toEqual(['a1']);
    expect(result.current.counts).toEqual({ active: 1, closed: 1 });
  });

  it("a staff member's counts reflect their scoped set even when list filters exclude everything", () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ id: 'staff-1', employee_role: 'staff' }) });
    const { result } = renderHook(() =>
      useAdminInquiryData({ ...BASE_QUERY, searchQuery: 'no such text anywhere' }),
    );

    expect(result.current.inquiries).toEqual([]);
    expect(result.current.counts).toEqual({ active: 1, closed: 1 });
  });
});

describe('useAdminInquiryData - loading', () => {
  it('is loading before the snapshot is hydrated', () => {
    useInquiryStore.setState({ inquiryByUuid: {}, inquiryUuids: [], snapshotStatus: 'idle' });
    const { result } = renderHook(() => useAdminInquiryData(BASE_QUERY));
    expect(result.current.loading).toBe(true);
  });

  it('is not loading once ready', () => {
    useCurrentStaffStore.setState({ staff: makeStaff({ employee_role: 'manager' }) });
    const { result } = renderHook(() => useAdminInquiryData(BASE_QUERY));
    expect(result.current.loading).toBe(false);
  });
});
