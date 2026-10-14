import { create } from 'zustand';
import { API_BASE_URL } from '../../../shared/api';
import { type User } from '../../../shared/auth/store/authStore';
import {
  StaffApiError,
  fetchStaffAssignments,
  fetchStaffByEmail,
  fetchStaffById,
  updateOwnStaffProfile,
} from '../api/staffApi';
import type { AssignedPet, StaffMember, StaffSelfEdit } from '../types/staff';

export type CurrentStaffStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CurrentStaffViewProps {
  staff: StaffMember;
  assignments: AssignedPet[];
  assignmentStatus: CurrentStaffStatus;
  assignmentError: string | null;
  saveError: string | null;
  saving: boolean;
  saveProfile: (changes: Partial<StaffSelfEdit>) => Promise<boolean>;
}

export interface CurrentStaffStoreState {
  requestId: number;
  /** Resolved StaffMember.id used by staff profile and assignment APIs. */
  identityKey: string | null;
  /** Stable key derived from the authenticated session input. */
  authIdentityKey: string | null;
  profileStatus: CurrentStaffStatus;
  assignmentStatus: CurrentStaffStatus;
  staff: StaffMember | null;
  assignments: AssignedPet[];
  profileError: string | null;
  assignmentError: string | null;
  saveError: string | null;
  saving: boolean;
  hydrate: (user: User) => Promise<void>;
  loadAssignments: () => Promise<void>;
  saveProfile: (changes: Partial<StaffSelfEdit>) => Promise<boolean>;
  clear: () => void;
}

interface CurrentStaffSnapshot {
  identityKey: string | null;
  authIdentityKey: string | null;
  profileStatus: CurrentStaffStatus;
  assignmentStatus: CurrentStaffStatus;
  staff: StaffMember | null;
  assignments: AssignedPet[];
  profileError: string | null;
  assignmentError: string | null;
  saveError: string | null;
  saving: boolean;
  requestId: number;
}

const initialSnapshot = (requestId: number): CurrentStaffSnapshot => ({
  identityKey: null,
  authIdentityKey: null,
  profileStatus: 'idle',
  assignmentStatus: 'idle',
  staff: null,
  assignments: [],
  profileError: null,
  assignmentError: null,
  saveError: null,
  saving: false,
  requestId,
});

let requestSequence = 0;
const inFlightHydrations = new Map<string, Promise<void>>();
const inFlightAssignments = new Map<string, Promise<void>>();

const identityKeyFor = (user: User): string => {
  return user.id ? `id:${user.id}` : `email:${user.email.trim().toLowerCase()}`;
};

const hasSameAuthenticatedIdentity = (authIdentityKey: string | null, user: User): boolean => {
  return authIdentityKey === identityKeyFor(user);
};

const describeProfileFailure = (caught: unknown, usedLegacyBootstrap: boolean): string => {
  if (usedLegacyBootstrap && caught instanceof StaffApiError && caught.status === 404) {
    return 'No employee account matches your sign-in email.';
  }
  if (caught instanceof TypeError) {
    return `Cannot reach the server at ${API_BASE_URL}. Start the backend with "npm run dev" in the Backend folder, then reload.`;
  }
  return 'Unable to load your profile. Please try again.';
};

const describeAssignmentFailure = (caught: unknown): string => {
  if (caught instanceof TypeError) {
    return `Cannot reach the server at ${API_BASE_URL}. Start the backend with "npm run dev" in the Backend folder, then reload.`;
  }
  return 'Unable to load assignments. Please try again.';
};

const describeSaveFailure = (caught: unknown): string => {
  if (caught instanceof StaffApiError && caught.message) {
    return caught.message;
  }
  return 'Could not save your profile.';
};

const isActiveRequest = (get: () => CurrentStaffStoreState, requestId: number): boolean => {
  return get().requestId === requestId;
};

const loadAssignmentsForRequest = async (
  get: () => CurrentStaffStoreState,
  set: (state: Partial<CurrentStaffStoreState & CurrentStaffSnapshot>) => void,
  staffId: string,
  requestId: number,
): Promise<void> => {
  const assignmentKey = `${requestId}:${staffId}`;
  const existing = inFlightAssignments.get(assignmentKey);
  if (existing) {
    return existing;
  }

  const load = (async (): Promise<void> => {
    try {
      const assignments = await fetchStaffAssignments(staffId);
      if (isActiveRequest(get, requestId) && get().staff?.id === staffId) {
        set({ assignments, assignmentStatus: 'ready', assignmentError: null });
      }
    } catch (caught) {
      if (isActiveRequest(get, requestId) && get().staff?.id === staffId) {
        set({
          assignments: [],
          assignmentStatus: 'error',
          assignmentError: describeAssignmentFailure(caught),
        });
      }
    }
  })();

  inFlightAssignments.set(assignmentKey, load);
  void load.then(
    () => {
      if (inFlightAssignments.get(assignmentKey) === load) {
        inFlightAssignments.delete(assignmentKey);
      }
    },
    () => {
      if (inFlightAssignments.get(assignmentKey) === load) {
        inFlightAssignments.delete(assignmentKey);
      }
    },
  );
  return load;
};

export const useCurrentStaffStore = create<CurrentStaffStoreState>((set, get) => {
  const clear = (): void => {
    requestSequence += 1;
    inFlightHydrations.clear();
    inFlightAssignments.clear();
    set(initialSnapshot(requestSequence));
  };

  const hydrate = (user: User): Promise<void> => {
    const identityKey = identityKeyFor(user);
    const current = get();
    if (
      current.profileStatus === 'ready' &&
      hasSameAuthenticatedIdentity(current.authIdentityKey, user)
    ) {
      return Promise.resolve();
    }

    const existing = inFlightHydrations.get(identityKey);
    if (existing) {
      return existing;
    }

    requestSequence += 1;
    inFlightHydrations.clear();
    const requestId = requestSequence;
    set({
      ...initialSnapshot(requestId),
      identityKey,
      authIdentityKey: identityKey,
      profileStatus: 'loading',
    });

    const load = (async (): Promise<void> => {
      try {
        const member = user.id
          ? await fetchStaffById(user.id)
          : await fetchStaffByEmail(user.email);
        if (!isActiveRequest(get, requestId)) {
          return;
        }

        set({
          identityKey: member.id,
          profileStatus: 'ready',
          profileError: null,
          staff: member,
          assignmentStatus: 'loading',
          assignmentError: null,
          assignments: [],
        });
        void loadAssignmentsForRequest(get, set, member.id, requestId);
      } catch (caught) {
        if (!isActiveRequest(get, requestId)) {
          return;
        }
        set({
          staff: null,
          assignments: [],
          profileStatus: 'error',
          profileError: describeProfileFailure(caught, !user.id),
          assignmentStatus: 'idle',
          assignmentError: null,
        });
      }
    })();

    inFlightHydrations.set(identityKey, load);
    void load.then(
      () => {
        if (inFlightHydrations.get(identityKey) === load) {
          inFlightHydrations.delete(identityKey);
        }
      },
      () => {
        if (inFlightHydrations.get(identityKey) === load) {
          inFlightHydrations.delete(identityKey);
        }
      },
    );
    return load;
  };

  const loadAssignments = (): Promise<void> => {
    const current = get();
    if (!current.staff) {
      return Promise.resolve();
    }
    set({ assignmentStatus: 'loading', assignmentError: null });
    return loadAssignmentsForRequest(get, set, current.staff.id, current.requestId);
  };

  const saveProfile = async (changes: Partial<StaffSelfEdit>): Promise<boolean> => {
    const current = get();
    if (!current.staff || current.profileStatus !== 'ready') {
      return false;
    }

    const { id: staffId } = current.staff;
    const { requestId } = current;
    set({ saving: true, saveError: null });
    try {
      const updated = await updateOwnStaffProfile(staffId, changes);
      if (!isActiveRequest(get, requestId) || get().staff?.id !== staffId) {
        return false;
      }
      set({ staff: updated });
      return true;
    } catch (caught) {
      if (isActiveRequest(get, requestId)) {
        set({ saveError: describeSaveFailure(caught) });
      }
      return false;
    } finally {
      if (isActiveRequest(get, requestId)) {
        set({ saving: false });
      }
    }
  };

  return {
    ...initialSnapshot(0),
    hydrate,
    loadAssignments,
    saveProfile,
    clear,
  };
});

export const clearCurrentStaffOnLogout = (): void => {
  useCurrentStaffStore.getState().clear();
};
