import React, { useEffect } from 'react';
import { Navigate, useRoutes, type RouteObject } from 'react-router-dom';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { LoadingState } from '../../../shared/components/ui/LoadingState';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminGoogleReviewDetailPage } from '../pages/AdminGoogleReviewDetailPage';
import { AdminFeedbackDetailPage } from '../pages/AdminFeedbackDetailPage';
import { AdminFeedbackLayout } from '../pages/AdminFeedbackLayout';
import { AdminFeedbackPage } from '../pages/AdminFeedbackPage';
import { AdminInquiriesPage } from '../pages/AdminInquiriesPage';
import { InquiryDetailFloatingPanel } from './inquiries/InquiryDetailFloatingPanel';
import { AdminProfilePage } from '../pages/AdminProfilePage';
import { TaskPage } from '../pages/TaskPage';
import { StaffShiftDashboardPage } from '../pages/StaffShiftDashboardPage';
import { PetDashboardPage } from '../pages/PetDashboardPage';
import { PetListPage } from '../pages/PetListPage';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { useGoogleReviewStoreSync } from '../store/googleReviewStore';
import { AdminNavbar } from './AdminNavbar';
import { AdminOperationPage } from '../pages/AdminOperationPage';
import { StaffDashboardPage } from '../pages/StaffDashboardPage';
import { AdminBookingsPage } from '../../admin/pages/AdminBookingsPage';
import { KpiReportPage } from '../pages/KpiReportPage';

// The manager route table owns the employee Feedback surface and Google Review detail route.
// Staff receive redirects for those paths below; this route choice, not link visibility, is the
// Frontend boundary for the manager-only pages.
const MANAGER_ADMIN_ROUTES: RouteObject[] = [
  { index: true, element: <AdminDashboardPage /> },
  { path: 'operation', element: <AdminOperationPage /> },
  {
    path: 'feedback',
    element: <AdminFeedbackLayout />,
    children: [
      { index: true, element: <AdminFeedbackPage /> },
      { path: ':id', element: <AdminFeedbackDetailPage /> },
    ],
  },
  { path: 'google-reviews/:id', element: <AdminGoogleReviewDetailPage /> },
  { path: 'inquiries', element: <AdminInquiriesPage /> },
  { path: 'notifications', element: <Navigate to="/admin" replace /> },
  { path: 'tasks', element: <TaskPage /> },
  { path: 'shifts', element: <StaffShiftDashboardPage /> },
  { path: 'staff-dashboard', element: <StaffDashboardPage /> },
  { path: 'profile', element: <AdminProfilePage profileType="manager" /> },
  { path: 'pets', element: <PetListPage /> },
  { path: 'pets/:id', element: <PetDashboardPage /> },
  { path: 'bookings', element: <AdminBookingsPage /> },
  { path: 'kpi-reports/:id', element: <KpiReportPage /> },
];

const STAFF_ADMIN_ROUTES: RouteObject[] = [
  { index: true, element: <AdminDashboardPage /> },
  { path: 'operation', element: <Navigate to="/admin" replace /> },
  { path: 'feedback/*', element: <Navigate to="/admin" replace /> },
  { path: 'google-reviews/:id', element: <Navigate to="/admin" replace /> },
  { path: 'inquiries', element: <AdminInquiriesPage /> },
  { path: 'notifications', element: <Navigate to="/admin" replace /> },
  { path: 'tasks', element: <TaskPage /> },
  { path: 'profile', element: <AdminProfilePage profileType="staff" /> },
  { path: 'pets', element: <PetListPage /> },
  { path: 'pets/:id', element: <PetDashboardPage /> },
  { path: 'bookings', element: <AdminBookingsPage staffDesk /> },
  { path: 'kpi-reports/:id', element: <Navigate to="/admin" replace /> },
  { path: 'shifts', element: <Navigate to="/admin" replace /> },
  { path: 'staff-dashboard', element: <Navigate to="/admin" replace /> },
];

/**
 * Selects and renders the employee admin route tree after the current staff profile is hydrated.
 *
 * @remarks
 * Google Review list/detail and the feedback dashboard are mounted only from the manager route
 * table. Staff are redirected before those pages render. These Frontend routes are a visibility
 * projection; the server remains authoritative for employee access and mutations.
 */
export const AdminPortal: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrate = useCurrentStaffStore((state) => state.hydrate);
  const clear = useCurrentStaffStore((state) => state.clear);
  const profileStatus = useCurrentStaffStore((state) => state.profileStatus);
  const profileError = useCurrentStaffStore((state) => state.profileError);
  const staff = useCurrentStaffStore((state) => state.staff);

  useEffect(() => {
    if (!isAuthenticated || !user || user.is_employee !== true) {
      clear();
      return;
    }
    void hydrate(user);
  }, [clear, hydrate, isAuthenticated, user]);

  const isManager = staff?.employee_role === 'manager';
  useGoogleReviewStoreSync(isManager);
  const routedPage = useRoutes(isManager ? MANAGER_ADMIN_ROUTES : STAFF_ADMIN_ROUTES);

  if (!isAuthenticated || !user || user.is_employee !== true) {
    return <Navigate to={user?.is_pet_owner ? '/parent' : '/login'} replace />;
  }

  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return <LoadingState label="Loading your admin website…" variant="page" />;
  }

  if (profileStatus === 'error' || !staff) {
    return (
      <p role="alert" className="mt-10 type-body text-status-danger">
        {profileError ?? 'Unable to load your employee profile.'}
      </p>
    );
  }

  return (
    // `bg-theme-page` paints the active theme's picture over `bg-surface-cream`, one screen in size.
    // The minimal themes have no picture, so under Simple, the staff default, the page is plain.
    <div className="admin-console min-h-screen bg-surface-cream bg-theme-page flex flex-col">
      <AdminNavbar />

      {/*
       * The console sits on the same translucent panel as the pet parent pages, so a theme's
       * picture shows through at the edges and every page reads off an opaque plate (AdminPage),
       * never off the photograph. The full-height pages cancel the panel padding with negative
       * margins and fill it.
       */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-2 pt-2 pb-8 sm:px-6 sm:pt-6 lg:p-8">
        <div className="parent-content-panel h-full rounded-2xl p-4 shadow-card sm:rounded-3xl sm:p-6 lg:p-8">
          {routedPage}
        </div>
      </main>

      <InquiryDetailFloatingPanel />
    </div>
  );
};
