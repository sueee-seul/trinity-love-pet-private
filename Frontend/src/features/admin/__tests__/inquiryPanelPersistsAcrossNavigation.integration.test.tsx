import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InquiryDetailFloatingPanel } from '../components/inquiries/InquiryDetailFloatingPanel';
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

const INQUIRY: InquiryConversation = {
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
};

/** Mirrors the shape of AdminPortal: a fixed layout with a routed page plus the floating panel. */
function AdminPortalHarness(): ReactElement {
  return (
    <Routes>
      <Route
        path="/admin/inquiries"
        element={
          <div>
            <h1>Inquiries page</h1>
            <Link to="/admin/pets">Go to Pets</Link>
            <InquiryDetailFloatingPanel />
          </div>
        }
      />
      <Route
        path="/admin/pets"
        element={
          <div>
            <h1>Pets page</h1>
            <InquiryDetailFloatingPanel />
          </div>
        }
      />
    </Routes>
  );
}

beforeEach(() => {
  useInquiryStore.getState().hydrateInquirySnapshot([INQUIRY], new Map());
  useInquiryStore.setState({ openConversationUuid: null, isPanelMinimized: false });
  useCurrentStaffStore.setState({ staff: STAFF });
});

describe('Inquiry detail panel persists across admin navigation (integration)', () => {
  it('stays open with the same conversation after navigating to a different admin page', async () => {
    act(() => {
      useInquiryStore.getState().openConversation(INQUIRY.uuid);
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/inquiries']}>
        <AdminPortalHarness />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Inquiries page' })).toBeInTheDocument();
    expect(screen.getByText('Conversation Details')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to Pets' }));

    expect(screen.getByRole('heading', { name: 'Pets page' })).toBeInTheDocument();
    expect(screen.getByText('Conversation Details')).toBeInTheDocument();
    expect(screen.getByText('Sarah Nguyen')).toBeInTheDocument();
    expect(useInquiryStore.getState().openConversationUuid).toBe(INQUIRY.uuid);
  });

  it('stays minimized across navigation rather than resetting to expanded', async () => {
    act(() => {
      useInquiryStore.getState().openConversation(INQUIRY.uuid);
      useInquiryStore.getState().minimizePanel();
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/inquiries']}>
        <AdminPortalHarness />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Conversation Details')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to Pets' }));

    expect(screen.queryByText('Conversation Details')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Expand conversation with Sarah Nguyen/ }),
    ).toBeInTheDocument();
  });
});
