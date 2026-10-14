import { create } from 'zustand';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { conciergeApi } from '../api/conciergeApi';
import type { ConciergeLastStay } from '../types';

/**
 * Whether the signed-in parent has an earlier stay to copy, read once per visit to the booking
 * page so the "same as last time" chip is offered only when it can work. The copy itself is made
 * by the chat turn, so nothing here is kept in the tab's storage.
 */

export type LastStayStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface LastStayState {
  lastStay: ConciergeLastStay | null;
  status: LastStayStatus;
  /** Asks the server once for this visit; a call while a request is on its way waits for it. */
  load: () => Promise<void>;
  clear: () => void;
}

/** Counts requests, so an answer that arrives after a sign-out or a newer request is dropped. */
let latestRequest = 0;

export const useLastStayStore = create<LastStayState>((set, get) => ({
  lastStay: null,
  status: 'idle',

  load: async (): Promise<void> => {
    if (get().status === 'loading') return;
    latestRequest += 1;
    const request = latestRequest;
    set({ status: 'loading' });
    try {
      const { lastStay } = await conciergeApi.fetchLastStay();
      if (request === latestRequest) set({ lastStay, status: 'ready' });
    } catch {
      // A guest (401), a staff account (403) or a server fault only means no chip is offered;
      // the parent can still type "same as last time" and the server answers the same way.
      if (request === latestRequest) set({ lastStay: null, status: 'failed' });
    }
  },

  clear: (): void => {
    latestRequest += 1;
    set({ lastStay: null, status: 'idle' });
  },
}));

// Signing out forgets the earlier stay, so the next person at a shared computer never sees it.
useAuthStore.subscribe((state, previous) => {
  if (previous.user && !state.user) useLastStayStore.getState().clear();
});
