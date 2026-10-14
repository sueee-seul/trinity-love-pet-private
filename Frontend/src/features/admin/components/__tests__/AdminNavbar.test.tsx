import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { BRAND_MARK_SRC } from '../../../../shared/brand/BrandMark';
import { AdminNavbar } from '../AdminNavbar';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { resetGoogleReviewStore, useGoogleReviewStore } from '../../store/googleReviewStore';
import type { StaffMember } from '../../types/staff';

const {
  mockLogout,
  mockEmployeeRole,
  mockMarkNotificationRead,
  mockReadAllNotifications,
  mockLoadMoreNotifications,
  mockResetNotificationStore,
  mockLoadNotifications,
  mockNotificationItems,
} = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockEmployeeRole: { value: 'staff' as 'manager' | 'staff' },
  mockMarkNotificationRead: vi.fn(),
  mockReadAllNotifications: vi.fn(),
  mockLoadMoreNotifications: vi.fn(),
  mockResetNotificationStore: vi.fn(),
  mockLoadNotifications: vi.fn(),
  mockNotificationItems: { value: [] as Record<string, unknown>[] },
}));

const GOOGLE_REVIEW_NOTIFICATION = {
  id: 'notification-1',
  type: 'google_review_created',
  category: 'google_review',
  title: 'New review from Emma',
  body: '5 stars · PetHouse',
  reviewerName: 'Emma',
  rating: 5,
  createdAt: '2026-09-11T09:00:00.000Z',
  readAt: null,
  target: {
    kind: 'google_review',
    reviewId: 'review-1',
    placeSlug: 'PetHouse',
  },
};

const BOOKING_REQUEST_NOTIFICATION = {
  id: 'notification-2',
  type: 'booking_request_created',
  category: 'booking',
  title: 'New booking request',
  body: 'Max, 12 to 15 Oct 2026. Reference PB-ABC123.',
  createdAt: '2026-09-12T09:00:00.000Z',
  readAt: null,
  target: { kind: 'booking', bookingId: 'booking-1' },
};

vi.mock('../../store/googleReviewNotificationStore', () => ({
  useGoogleReviewNotifications: (): Record<string, unknown> => ({
    items: mockNotificationItems.value,
    unreadCount: 1,
    nextCursor: null,
    status: 'ready',
    error: null,
    loadMore: mockLoadMoreNotifications,
    markRead: mockMarkNotificationRead,
    readAll: mockReadAllNotifications,
  }),
  resetGoogleReviewNotificationStore: mockResetNotificationStore,
  loadGoogleReviewNotifications: mockLoadNotifications,
  markGoogleReviewNotificationRead: mockMarkNotificationRead,
  loadMoreGoogleReviewNotifications: mockLoadMoreNotifications,
  readAllGoogleReviewNotifications: mockReadAllNotifications,
}));

vi.mock('../../../../shared/auth/store/authStore', () => ({
  useAuthStore: (
    selector: (state: {
      logout: () => void;
      user: {
        email: string;
        is_employee: boolean;
        is_pet_owner: boolean;
        employee_role: 'manager' | 'staff';
      };
    }) => unknown,
  ): unknown =>
    selector({
      logout: mockLogout,
      user: {
        email: 'manager@wagstay.com',
        is_employee: true,
        is_pet_owner: false,
        employee_role: mockEmployeeRole.value,
      },
    }),
}));

const { fetchStaffById, fetchStaffByEmail, fetchStaffAssignments } = vi.hoisted(() => ({
  fetchStaffById: vi.fn(),
  fetchStaffByEmail: vi.fn(),
  fetchStaffAssignments: vi.fn(),
}));

vi.mock('../../api/staffApi', () => ({
  StaffApiError: class StaffApiError extends Error {
    public readonly status = 500;
  },
  fetchStaffById,
  fetchStaffByEmail,
  fetchStaffAssignments,
  updateOwnStaffProfile: vi.fn(),
}));

const CURRENT_STAFF: StaffMember = {
  id: 'staff-1',
  name: 'Alice Manager',
  username: 'test.user',
  email: 'manager@wagstay.com',
  phone: null,
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

const renderNavbar = (initialPath = '/admin'): RenderResult => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/*" element={<AdminNavbar />} />
      </Routes>
    </MemoryRouter>,
  );
};

const renderAccountMenuRoutes = (): RenderResult => {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin/*" element={<AdminNavbar />} />
        <Route path="/admin/profile" element={<h1>Staff Profile</h1>} />
        <Route path="/" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  mockNotificationItems.value = [GOOGLE_REVIEW_NOTIFICATION];
});

afterEach(() => {
  mockLogout.mockReset();
  mockEmployeeRole.value = 'staff';
  useCurrentStaffStore.getState().clear();
  resetGoogleReviewStore();
  fetchStaffById.mockReset();
  fetchStaffByEmail.mockReset();
  fetchStaffAssignments.mockReset();
  mockMarkNotificationRead.mockReset();
  mockReadAllNotifications.mockReset();
  mockLoadMoreNotifications.mockReset();
  mockResetNotificationStore.mockReset();
  mockLoadNotifications.mockReset();
});

describe('AdminNavbar', () => {
  it('keeps authenticated Manager navigation visible at tablet viewport widths', () => {
    mockEmployeeRole.value = 'manager';
    renderNavbar();

    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveClass('md:flex');
    expect(navigation).not.toHaveClass('lg:flex');

    expect(screen.getByRole('link', { name: 'Petlist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Feedback' })).toBeInTheDocument();
  });

  it('hides Feedback and Operation for Staff, and shows them the Bookings', () => {
    renderNavbar();

    expect(screen.queryByRole('link', { name: 'Feedback' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Operation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Petlist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('marks the current page as the solid pill, nested pages included', () => {
    mockEmployeeRole.value = 'manager';
    renderNavbar('/admin/pets/pet-42');
    const navigation = screen.getByRole('navigation', { name: 'Admin' });

    expect(within(navigation).getByRole('link', { name: 'Petlist' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Tasks' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('opens the phone menu as a disclosure with the current page marked', async () => {
    const user = userEvent.setup();
    renderNavbar('/admin/tasks');
    const toggle = screen.getByRole('button', { name: 'Toggle mobile menu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(menu).not.toBeNull();
    expect(within(menu as HTMLElement).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the Wagstay brand linking to the admin home', () => {
    renderNavbar();

    const brand = screen.getByRole('link', { name: /Wagstay/ });
    expect(brand).toHaveAttribute('href', '/admin');
    // The same fixed paw as everywhere else, not a theme-coloured tile.
    expect(brand.querySelector(`img[src="${BRAND_MARK_SRC}"]`)).not.toBeNull();
  });

  it('opens the manager notification dropdown on click', async () => {
    const user = userEvent.setup();
    mockEmployeeRole.value = 'manager';
    renderNavbar();

    // The unread count is part of the button's name; the badge only shows it.
    const notificationButton = screen.getByRole('button', {
      name: 'Open notifications, 1 unread',
    });

    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
    const notificationBadge = within(notificationButton).getByText('1');
    expect(notificationBadge).toHaveAttribute('aria-hidden', 'true');
    expect(notificationBadge).toHaveClass('-right-2', '-top-1.5');

    await user.click(notificationButton);

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    expect(mockLoadNotifications).toHaveBeenCalledWith(true);
    expect(screen.getByText('New review from Emma')).toBeInTheDocument();
    expect(screen.getByText('5 stars · PetHouse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New review from Emma/ })).toHaveClass(
      'bg-surface-deep',
    );

    await user.click(notificationButton);

    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('closes the notification dropdown with Escape', async () => {
    const user = userEvent.setup();
    mockEmployeeRole.value = 'manager';
    renderNavbar();

    const notificationButton = screen.getByRole('button', { name: /^Open notifications/ });
    await user.click(notificationButton);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('calls logout when Change account is clicked', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Change account' }));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('opens the admin account menu and links to the staff profile route', async () => {
    const user = userEvent.setup();
    renderAccountMenuRoutes();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Staff Profile' }));

    expect(screen.getByRole('heading', { name: 'Staff Profile' })).toBeInTheDocument();
  });

  it('closes the staff account menu with Escape', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    expect(screen.getByRole('menu', { name: 'Admin account menu' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: 'Admin account menu' })).not.toBeInTheDocument();
  });

  it('closes the staff account menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    await user.click(document.body);

    expect(screen.queryByRole('menu', { name: 'Admin account menu' })).not.toBeInTheDocument();
  });

  it('clears auth state and returns to sign in on logout', async () => {
    const user = userEvent.setup();
    useGoogleReviewStore.setState({
      reviewPage: { reviews: [] },
      status: 'ready',
      error: null,
    });
    renderAccountMenuRoutes();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(useGoogleReviewStore.getState().reviewPage).toBeNull();
    expect(useGoogleReviewStore.getState().status).toBe('idle');
  });

  it('reads the shared current-staff snapshot and clears it on logout without fetching', async () => {
    useCurrentStaffStore.setState({
      staff: CURRENT_STAFF,
      identityKey: CURRENT_STAFF.id,
      profileStatus: 'ready',
      assignmentStatus: 'ready',
    });
    const user = userEvent.setup();
    renderAccountMenuRoutes();

    await user.click(screen.getByRole('button', { name: 'Open admin account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Manager Profile' })).toBeInTheDocument();
    expect(fetchStaffById).not.toHaveBeenCalled();
    expect(fetchStaffByEmail).not.toHaveBeenCalled();
    expect(fetchStaffAssignments).not.toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(useCurrentStaffStore.getState().staff).toBeNull();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('opens a review directly from the manager notification dropdown', async () => {
    const user = userEvent.setup();
    mockEmployeeRole.value = 'manager';
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminNavbar />} />
          <Route path="/admin/google-reviews/:id" element={<h1>Review detail</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /^Open notifications/ }));
    await user.click(screen.getByRole('button', { name: /New review from Emma/ }));

    expect(screen.getByRole('heading', { name: 'Review detail' })).toBeInTheDocument();
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('notification-1');
  });

  it('opens the bookings page from a new booking request', async () => {
    const user = userEvent.setup();
    mockEmployeeRole.value = 'manager';
    mockNotificationItems.value = [BOOKING_REQUEST_NOTIFICATION];
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminNavbar />} />
          <Route path="/admin/bookings" element={<h1>Bookings</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /^Open notifications/ }));
    expect(screen.getByText('Bookings', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Max, 12 to 15 Oct 2026. Reference PB-ABC123.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /New booking request/ }));

    expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('notification-2');
  });

  it('does not render the notification bell for staff', () => {
    renderNavbar();

    expect(screen.queryByRole('button', { name: /^Open notifications/ })).not.toBeInTheDocument();
  });
});
