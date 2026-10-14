import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPortal } from '../../components/AdminPortal';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { useCurrentStaffStore } from '../../store/currentStaffStore';

const mockAuth = vi.hoisted(() => {
  const state = {
    user: null as {
      id?: string;
      email: string;
      name?: string;
      is_employee: boolean;
      is_pet_owner: boolean;
      employee_role?: 'manager' | 'staff' | null;
    } | null,
    isAuthenticated: false,
  };
  const useAuthStore = Object.assign(
    (selector: (value: typeof state) => unknown): unknown => selector(state),
    {
      getState: (): typeof state => state,
      setState: (partial: Partial<typeof state>): void => {
        Object.assign(state, partial);
      },
    },
  );
  return { useAuthStore };
});

vi.mock('../../../../shared/auth/store/authStore', () => ({
  useAuthStore: mockAuth.useAuthStore,
}));
import type { AssignedPet, StaffMember } from '../../types/staff';

const MANAGER: StaffMember = {
  id: 'u1',
  name: 'Alice Manager',
  username: 'test.user',
  email: 'manager@wagstay.com',
  phone: '+64 21 555 0100',
  employee_role: 'manager',
  status: 'active',
  employeeNumber: 'WS-0001',
  joinedDate: '03/02/2024',
  avatarUrl: null,
  facilityUuid: 'facility-1',
  facilityName: 'Trinity Central',
  employmentType: 'full-time',
  title: null,
  shiftDetails: null,
};

const CARER: StaffMember = {
  id: 'u2',
  name: 'Bob Staff',
  username: 'test.user',
  email: 'staff1@wagstay.com',
  phone: null,
  employee_role: 'staff',
  status: 'active',
  employeeNumber: 'WS-0002',
  joinedDate: '19/05/2024',
  avatarUrl: null,
  facilityUuid: 'facility-1',
  facilityName: 'Trinity Central',
  employmentType: 'full-time',
  title: null,
  shiftDetails: null,
};

const ASSIGNMENTS: AssignedPet[] = [
  {
    petId: 'p1',
    petName: 'Sherlock',
    petType: 'Dog',
    ownerName: 'Jennifer Andrews',
    checkInDate: '15/08/2026',
    checkOutDate: '20/08/2026',
  },
];

const { fetchStaffByEmail, fetchStaffById, fetchStaffAssignments, fetchStaffManagementOptions } =
  vi.hoisted(() => ({
    fetchStaffByEmail: vi.fn(async (email: string) => (email === MANAGER.email ? MANAGER : CARER)),
    fetchStaffById: vi.fn(async (id: string) => (id === MANAGER.id ? MANAGER : CARER)),
    fetchStaffAssignments: vi.fn(async () => ASSIGNMENTS),
    fetchStaffManagementOptions: vi.fn(async () => ({
      facilities: [{ id: 'facility-1', name: 'Trinity Central' }],
      employmentTypes: ['full-time', 'part-time'],
    })),
  }));

vi.mock('../../api/staffApi', () => ({
  fetchStaffByEmail,
  fetchStaffById,
  fetchStaffAssignments,
  fetchStaffManagementOptions,
  fetchStaffList: vi.fn(async () => [MANAGER, CARER]),
  updateOwnStaffProfile: vi.fn(),
  updateStaffMember: vi.fn(),
  createStaffMember: vi.fn(),
  deleteStaffMember: vi.fn(),
}));

const signInAs = (member: StaffMember): void => {
  useAuthStore.setState({
    user: {
      id: member.id,
      email: member.email,
      name: member.name,
      is_employee: true,
      is_pet_owner: false,
      employee_role: member.employee_role,
    },
    isAuthenticated: true,
  });
};

const renderProfile = (initialEntry = '/admin/profile'): void => {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/*" element={<AdminPortal />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('AdminProfilePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useCurrentStaffStore.getState().clear();
    fetchStaffByEmail.mockClear();
    fetchStaffById.mockClear();
    fetchStaffAssignments.mockClear();
    fetchStaffManagementOptions.mockClear();
  });

  it('shows a signed-out state instead of an endless loading state', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Loading your admin website…')).not.toBeInTheDocument();
  });

  it('hides manager-only operation and feedback navigation for a carer', async () => {
    signInAs(CARER);
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Staff profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Operation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Feedback' })).not.toBeInTheDocument();
  });

  it('redirects a carer away from the manager-only operation dashboard route', async () => {
    signInAs(CARER);
    renderProfile('/admin/operation');

    expect(
      await screen.findByRole('heading', { name: 'Admin Website Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Feedback Operations')).not.toBeInTheDocument();
  });

  it('redirects a carer away from the manager-only feedback route', async () => {
    signInAs(CARER);
    renderProfile('/admin/feedback');

    expect(
      await screen.findByRole('heading', { name: 'Admin Website Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Feedback Overview')).not.toBeInTheDocument();
  });

  it('opens team management from the operation page for a manager', async () => {
    signInAs(MANAGER);
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: MANAGER.name })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Operation' }));

    const operationNavigation = within(
      screen.getByRole('navigation', { name: 'Operation workspace sections' }),
    );

    await waitFor(() => {
      expect(
        operationNavigation.getByRole('button', { name: 'Team Management' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(operationNavigation.getByRole('button', { name: 'Team Management' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Team management' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Add staff member' })).toBeInTheDocument();
  });

  it('lists the pets assigned to the signed-in person', async () => {
    signInAs(CARER);
    renderProfile();

    await screen.findByRole('heading', { name: 'Staff profile' });
    fireEvent.click(screen.getByRole('button', { name: 'Assigned Pets' }));

    expect(await screen.findByText('Sherlock')).toBeInTheDocument();
  });

  it('offers no role control on a carer own profile', async () => {
    signInAs(CARER);
    renderProfile();

    await screen.findByRole('heading', { name: 'Staff profile' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Your role is set by a manager.')).toBeInTheDocument();
  });

  it('does not tell a manager their role is set by a manager', async () => {
    signInAs(MANAGER);
    renderProfile();

    await screen.findByRole('heading', { name: 'My workspace' });
    expect(screen.queryByText('Your role is set by a manager.')).not.toBeInTheDocument();
    expect(screen.getByText('Roles are changed from the team list below.')).toBeInTheDocument();
  });

  it('keeps the role unresolved until the manager profile is ready', async () => {
    let resolveProfile: (member: StaffMember) => void = () => undefined;
    const profile = new Promise<StaffMember>((resolve) => {
      resolveProfile = resolve;
    });
    fetchStaffById.mockReturnValueOnce(profile);

    signInAs(MANAGER);
    renderProfile();

    expect(screen.getByText('Loading your admin website…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Staff profile' })).not.toBeInTheDocument();

    resolveProfile(MANAGER);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    });
  });
});
