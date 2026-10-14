import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInquiries } from '../../__tests__/inquiryFixtures';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { useInquiryStore } from '../../store/inquiryStore';
import type { StaffMember } from '../../types/staff';
import { AdminInquiriesPage } from '../AdminInquiriesPage';

vi.mock('../../api/staffApi', () => ({
  StaffApiError: class StaffApiError extends Error {
    public readonly status = 500;
  },
  fetchStaffList: vi.fn().mockResolvedValue([]),
  fetchStaffManagementOptions: vi.fn().mockResolvedValue({ facilities: [], employmentTypes: [] }),
  createStaffMember: vi.fn(),
  updateStaffMember: vi.fn(),
  deleteStaffMember: vi.fn(),
}));

vi.mock('../../api/inquiryApi', () => ({
  fetchInquiries: vi.fn(),
  assignStaffOnServer: vi.fn().mockResolvedValue(undefined),
  resolveInquiryOnServer: vi.fn().mockResolvedValue(undefined),
  saveNotesOnServer: vi.fn().mockResolvedValue(undefined),
  sendStaffMessageOnServer: vi.fn().mockResolvedValue(undefined),
}));

const MANAGER: StaffMember = {
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

beforeEach(async () => {
  const { fetchInquiries } = await import('../../api/inquiryApi');
  vi.mocked(fetchInquiries).mockReset().mockResolvedValue(createMockInquiries(MANAGER));
  useInquiryStore.setState({
    inquiryByUuid: {},
    inquiryUuids: [],
    snapshotStatus: 'idle',
    snapshotError: null,
    openConversationUuid: null,
    isPanelMinimized: false,
  });
  useCurrentStaffStore.setState({ staff: MANAGER });
});

describe('AdminInquiriesPage - sort toggling', () => {
  it('toggles direction when the currently-active sort field is clicked again', async () => {
    const user = userEvent.setup();
    render(<AdminInquiriesPage />);
    await screen.findByRole('table');

    // Default sort is startedAt/desc - the chevron on Started should be rotated (asc marker off).
    const startedButton = screen.getByRole('button', { name: /Sort by Started/ });
    expect(startedButton).toHaveAccessibleName(expect.stringContaining('descending'));

    await user.click(startedButton);

    expect(screen.getByRole('button', { name: /Sort by Started/ })).toHaveAccessibleName(
      expect.stringContaining('ascending'),
    );
  });

  it("switching to a different field uses that field's sensible default direction", async () => {
    const user = userEvent.setup();
    render(<AdminInquiriesPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /Sort by Duration/ }));

    expect(screen.getByRole('button', { name: /Sort by Duration/ })).toHaveAccessibleName(
      expect.stringContaining('ascending'),
    );
  });
});

describe('AdminInquiriesPage - tab switching does not disturb the open panel', () => {
  it('keeps the floating panel open across an Active/Closed tab switch', async () => {
    const user = userEvent.setup();
    render(<AdminInquiriesPage />);

    const table = await screen.findByRole('table');
    void table; // ensure the snapshot has hydrated before selecting

    const openUuid = Object.keys(useInquiryStore.getState().inquiryByUuid)[0];
    act(() => {
      useInquiryStore.getState().openConversation(openUuid);
    });

    await user.click(screen.getByRole('button', { name: /Closed/ }));

    expect(useInquiryStore.getState().openConversationUuid).toBe(openUuid);
  });
});

describe('AdminInquiriesPage - table selection uses the shared store', () => {
  it('clicking a row calls openConversation via the store, not local state', async () => {
    const user = userEvent.setup();
    render(<AdminInquiriesPage />);

    await screen.findByRole('table');
    expect(useInquiryStore.getState().openConversationUuid).toBeNull();

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row.
    await user.click(rows[1]);

    const opened = useInquiryStore.getState().openConversationUuid;
    expect(opened).not.toBeNull();
    expect(useInquiryStore.getState().inquiryByUuid[opened as string].status).toBe('Active');
  });
});
