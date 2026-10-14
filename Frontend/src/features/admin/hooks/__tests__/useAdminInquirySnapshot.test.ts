import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as inquiryApi from '../../api/inquiryApi';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { useInquiryStore } from '../../store/inquiryStore';
import type { InquiryConversation } from '../../types/inquiry';
import type { StaffMember } from '../../types/staff';
import { useAdminInquirySnapshot } from '../useAdminInquirySnapshot';

vi.mock('../../api/inquiryApi', () => ({
  fetchInquiries: vi.fn(),
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

const STAFF: StaffMember = {
  id: 'staff-1',
  name: 'Alice Manager',
  username: 'alice',
  email: 'alice@wagstay.com',
  phone: null,
  employee_role: 'manager',
  status: 'active',
  employeeNumber: 'WS-0001',
  joinedDate: '01/01/2026',
  avatarUrl: null,
  facilityUuid: 'facility-1',
  facilityName: 'Central',
  employmentType: 'full-time',
  title: null,
  shiftDetails: null,
};

const FIXTURE_INQUIRY: InquiryConversation = {
  uuid: 'inq-bella-care',
  parentName: 'Sarah Nguyen',
  parentInitials: 'SN',
  petName: 'Bella',
  topic: "Bella's Care Updates",
  topicCategory: 'Feeding',
  startedAt: new Date().toISOString(),
  durationMinutes: 25,
  status: 'Active',
  supportStatus: 'AI Handling',
  supportRequestedAt: null,
  assignee: null,
  notes: '',
  aiSummary: '',
  aiDetectedTopic: '',
  aiEscalationReason: null,
  aiRelevantInfo: '',
  messages: [],
};

function resetStores(): void {
  useInquiryStore.setState({
    inquiryByUuid: {},
    inquiryUuids: [],
    snapshotStatus: 'idle',
    snapshotError: null,
  });
  useCurrentStaffStore.getState().clear();
}

beforeEach(() => {
  vi.mocked(inquiryApi.fetchInquiries).mockReset().mockResolvedValue([FIXTURE_INQUIRY]);
  resetStores();
});

describe('useAdminInquirySnapshot', () => {
  it('does not hydrate while staff is unknown', () => {
    renderHook(() => useAdminInquirySnapshot());
    expect(useInquiryStore.getState().snapshotStatus).toBe('idle');
    expect(inquiryApi.fetchInquiries).not.toHaveBeenCalled();
  });

  it('hydrates the store once staff becomes available', async () => {
    useCurrentStaffStore.setState({ staff: STAFF });
    renderHook(() => useAdminInquirySnapshot());

    await waitFor(() => expect(useInquiryStore.getState().snapshotStatus).toBe('ready'));
    expect(useInquiryStore.getState().inquiryUuids.length).toBeGreaterThan(0);
  });

  it('does not re-hydrate once the snapshot is already ready', async () => {
    useCurrentStaffStore.setState({ staff: STAFF });
    renderHook(() => useAdminInquirySnapshot());
    await waitFor(() => expect(useInquiryStore.getState().snapshotStatus).toBe('ready'));

    useInquiryStore.getState().setNote('inq-bella-care', 'edited by hand');

    // A second mount with the same (ready) snapshot must not re-seed and wipe the edit.
    renderHook(() => useAdminInquirySnapshot());

    expect(useInquiryStore.getState().inquiryByUuid['inq-bella-care'].notes).toBe('edited by hand');
    expect(inquiryApi.fetchInquiries).toHaveBeenCalledTimes(1);
  });

  it('records an error when the inquiries request fails', async () => {
    vi.mocked(inquiryApi.fetchInquiries).mockRejectedValueOnce(new Error('network down'));
    useCurrentStaffStore.setState({ staff: STAFF });
    renderHook(() => useAdminInquirySnapshot());

    await waitFor(() => expect(useInquiryStore.getState().snapshotStatus).toBe('error'));
    expect(useInquiryStore.getState().snapshotError).toBe('network down');
  });
});
