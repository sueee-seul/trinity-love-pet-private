import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import {
  getSyncState,
  hydrateFromServer,
  resetHydration,
  subscribeSyncState,
  type ProfileSyncState,
} from './repository';

export interface ProfileSync extends ProfileSyncState {
  /** Asks the server for the profile again, after a load that failed. */
  retry: () => void;
}

/**
 * Loads the profile from the API on first mount and reports how that went.
 *
 * The email is only the cache key for "which account is this". The server
 * reads whose profile to return from the session cookie. An account that is
 * not a pet owner has no parent profile to load, so nothing is fetched.
 */
export function useProfileSync(): ProfileSync {
  const [state, setState] = useState<ProfileSyncState>(() => getSyncState());
  // Matches the route guard and the server: an employee account has no parent
  // profile to load, whatever `is_pet_owner` says about it.
  const email = useAuthStore((store) =>
    store.user?.is_pet_owner && !store.user.is_employee ? store.user.email : undefined,
  );

  useEffect(() => subscribeSyncState(() => setState(getSyncState())), []);

  useEffect(() => {
    if (!email) {
      return;
    }
    void hydrateFromServer(email);
  }, [email]);

  // A failed load still marks the account as fetched, so a second mount would not ask again.
  // Retrying clears that mark first; without it the page could only recover by reloading.
  const retry = useCallback((): void => {
    if (!email) {
      return;
    }
    resetHydration();
    void hydrateFromServer(email);
  }, [email]);

  return { ...state, retry };
}
