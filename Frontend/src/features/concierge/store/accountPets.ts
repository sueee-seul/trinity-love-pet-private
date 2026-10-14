import { create } from 'zustand';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import type { Pet } from '../../pet-parent/types/booking';
import { conciergeApi } from '../api/conciergeApi';

/**
 * The signed-in parent's saved pets for this visit to the booking page. The pet chips, the name
 * matching in the chat and the details step all read this one list, so the page asks the server
 * once per visit instead of once per component. It is never kept in the tab's storage.
 */

export type AccountPetsStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface AccountPetsState {
  pets: Pet[];
  status: AccountPetsStatus;
  /** Asks the server for this visit; a call while a request is on its way waits for that one. */
  load: () => Promise<void>;
  clear: () => void;
}

/** Counts requests, so an answer that arrives after a sign-out or a newer request is dropped. */
let latestRequest = 0;

export const useAccountPetsStore = create<AccountPetsState>((set, get) => ({
  pets: [],
  status: 'idle',

  load: async (): Promise<void> => {
    if (get().status === 'loading') return;
    latestRequest += 1;
    const request = latestRequest;
    set({ status: 'loading' });
    try {
      const pets = await conciergeApi.myPets();
      if (request === latestRequest) set({ pets, status: 'ready' });
    } catch {
      // Saved pets are a shortcut: without them the parent describes each pet as a guest would.
      if (request === latestRequest) set({ pets: [], status: 'failed' });
    }
  },

  clear: (): void => {
    latestRequest += 1;
    set({ pets: [], status: 'idle' });
  },
}));

// Signing out forgets the pets, so the next person at a shared computer never sees them.
useAuthStore.subscribe((state, previous) => {
  if (previous.user && !state.user) useAccountPetsStore.getState().clear();
});
