import React from 'react';
import { ManagerProfilePage } from './ManagerProfilePage';
import { StaffProfilePage } from './StaffProfilePage';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { LoadingState } from '../../../shared/components/ui/LoadingState';

/**
 * One route, two shapes. A manager sees their own profile plus the team they
 * administer; everyone else sees their own profile only. Routing on employee
 * role rather than on a separate URL keeps "my profile" meaning the same thing
 * for both.
 */
interface AdminProfilePageProps {
  profileType?: 'manager' | 'staff';
}

export const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ profileType }) => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profileStatus = useCurrentStaffStore((state) => state.profileStatus);
  const staff = useCurrentStaffStore((state) => state.staff);
  const assignments = useCurrentStaffStore((state) => state.assignments);
  const assignmentStatus = useCurrentStaffStore((state) => state.assignmentStatus);
  const assignmentError = useCurrentStaffStore((state) => state.assignmentError);
  const profileError = useCurrentStaffStore((state) => state.profileError);
  const saveError = useCurrentStaffStore((state) => state.saveError);
  const saving = useCurrentStaffStore((state) => state.saving);
  const saveProfile = useCurrentStaffStore((state) => state.saveProfile);

  if (!isAuthenticated || !user || user.is_employee !== true) {
    return (
      <p role="alert" className="mt-10 type-body text-status-danger">
        Sign in to see your profile.
      </p>
    );
  }

  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return (
      <LoadingState
        label="Loading your profile…"
        variant="page"
        className="mt-10 min-h-0 justify-start"
      />
    );
  }

  if (profileStatus === 'error' || !staff) {
    return (
      <p role="alert" className="mt-10 type-body text-status-danger">
        {profileError ?? 'Unable to load your profile.'}
      </p>
    );
  }

  const viewProps = {
    staff,
    assignments,
    assignmentStatus,
    assignmentError,
    saveError,
    saving,
    saveProfile,
  };

  const resolvedProfileType =
    profileType ?? (staff.employee_role === 'manager' ? 'manager' : 'staff');

  return resolvedProfileType === 'manager' ? (
    <ManagerProfilePage {...viewProps} />
  ) : (
    <StaffProfilePage {...viewProps} />
  );
};
