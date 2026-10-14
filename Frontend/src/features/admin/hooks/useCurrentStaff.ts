import { useCurrentStaffStore, type CurrentStaffStoreState } from '../store/currentStaffStore';

export interface CurrentStaffState {
  staff: CurrentStaffStoreState['staff'];
  assignments: CurrentStaffStoreState['assignments'];
  loading: boolean;
  error: string | null;
  saveError: string | null;
  saving: boolean;
  saveProfile: CurrentStaffStoreState['saveProfile'];
}

/**
 * Compatibility selector for callers outside the admin profile boundary.
 * Hydration is owned by currentStaffStore and AdminPortal; this hook does not
 * start requests or keep a second current-staff snapshot.
 */
export const useCurrentStaff = (): CurrentStaffState => {
  const staff = useCurrentStaffStore((state) => state.staff);
  const assignments = useCurrentStaffStore((state) => state.assignments);
  const profileStatus = useCurrentStaffStore((state) => state.profileStatus);
  const error = useCurrentStaffStore((state) => state.profileError);
  const saveError = useCurrentStaffStore((state) => state.saveError);
  const saving = useCurrentStaffStore((state) => state.saving);
  const saveProfile = useCurrentStaffStore((state) => state.saveProfile);

  return {
    staff,
    assignments,
    loading: profileStatus === 'idle' || profileStatus === 'loading',
    error,
    saveError,
    saving,
    saveProfile,
  };
};
