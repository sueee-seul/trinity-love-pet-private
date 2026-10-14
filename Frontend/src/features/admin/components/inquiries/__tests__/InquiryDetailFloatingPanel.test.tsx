import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentStaffStore } from '../../../store/currentStaffStore';
import { useInquiryStore } from '../../../store/inquiryStore';
import type { InquiryConversation } from '../../../types/inquiry';
import type { StaffMember } from '../../../types/staff';
import { InquiryDetailFloatingPanel } from '../InquiryDetailFloatingPanel';

vi.mock('../../../api/staffApi', () => ({
  StaffApiError: class StaffApiError extends Error {
    public readonly status = 500;
  },
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

function makeInquiry(overrides: Partial<InquiryConversation>): InquiryConversation {
  return {
    uuid: 'inq-1',
    parentName: 'Sarah Nguyen',
    parentInitials: 'SN',
    petName: 'Bella',
    topic: "Bella's Care Updates",
    topicCategory: 'Feeding',
    startedAt: '2026-06-15T10:00:00.000Z',
    durationMinutes: 20,
    status: 'Active',
    supportStatus: 'AI Handling',
    supportRequestedAt: null,
    assignee: null,
    notes: '',
    aiSummary: 'Summary',
    aiDetectedTopic: 'Feeding',
    aiEscalationReason: null,
    aiRelevantInfo: 'Info',
    messages: [],
    ...overrides,
  };
}

const INQUIRY_A = makeInquiry({ uuid: 'inq-a', parentName: 'Sarah Nguyen' });
const INQUIRY_B = makeInquiry({
  uuid: 'inq-b',
  parentName: 'Marcus Reid',
  topic: 'Booking enquiry',
});

beforeEach(() => {
  useInquiryStore.setState({
    inquiryByUuid: { [INQUIRY_A.uuid]: INQUIRY_A, [INQUIRY_B.uuid]: INQUIRY_B },
    inquiryUuids: [INQUIRY_A.uuid, INQUIRY_B.uuid],
    snapshotStatus: 'ready',
    snapshotError: null,
    openConversationUuid: null,
    isPanelMinimized: false,
  });
  useCurrentStaffStore.setState({ staff: STAFF });
});

describe('InquiryDetailFloatingPanel', () => {
  it('renders nothing when no conversation is open', () => {
    const { container } = render(<InquiryDetailFloatingPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the minimized bar when isPanelMinimized is true', () => {
    useInquiryStore.setState({ openConversationUuid: INQUIRY_A.uuid, isPanelMinimized: true });
    render(<InquiryDetailFloatingPanel />);

    expect(
      screen.getByRole('button', { name: /Expand conversation with Sarah Nguyen/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minimise panel' })).not.toBeInTheDocument();
  });

  it('renders the full detail panel when open and not minimized', () => {
    useInquiryStore.setState({ openConversationUuid: INQUIRY_A.uuid, isPanelMinimized: false });
    render(<InquiryDetailFloatingPanel />);

    expect(screen.getByText('Conversation Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minimise panel' })).toBeInTheDocument();
  });

  it('resets card-local state (e.g. an in-progress note draft) when switching conversations', async () => {
    const user = userEvent.setup();
    useInquiryStore.setState({ openConversationUuid: INQUIRY_A.uuid });
    render(<InquiryDetailFloatingPanel />);

    await user.type(screen.getByPlaceholderText('Add a note for the team…'), 'draft for A');
    expect(screen.getByPlaceholderText('Add a note for the team…')).toHaveValue('draft for A');

    act(() => {
      useInquiryStore.getState().openConversation(INQUIRY_B.uuid);
    });

    expect(screen.getByPlaceholderText('Add a note for the team…')).toHaveValue('');
  });

  it('wires onSaveNotes to setNote for the currently-open conversation', async () => {
    const user = userEvent.setup();
    useInquiryStore.setState({ openConversationUuid: INQUIRY_A.uuid });
    render(<InquiryDetailFloatingPanel />);

    await user.type(screen.getByPlaceholderText('Add a note for the team…'), 'Saved note');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useInquiryStore.getState().inquiryByUuid[INQUIRY_A.uuid].notes).toBe('Saved note');
    expect(useInquiryStore.getState().inquiryByUuid[INQUIRY_B.uuid].notes).toBe('');
  });
});
