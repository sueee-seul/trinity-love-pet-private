import { create } from 'zustand';
import type { ReviewerProfile } from '../api/reviewerAuthApi';

/**
 * State and actions for the Maps-review reviewer identity.
 */
interface ReviewerAuthState {
  /** The hydrated reviewer projection if authenticated. */
  reviewer: ReviewerProfile | null;
  /** True if the reviewer is fully logged in. */
  isAuthenticated: boolean;
  /** True while the initial cookie-backed hydration request is pending. */
  isHydrating: boolean;

  /** Hydrates the store with the authenticated reviewer profile. */
  login: (reviewer: ReviewerProfile) => void;
  /** Clears the session state. */
  logout: () => void;
  /** Signals that initial session resolution has finished or is still pending. */
  setHydrating: (isHydrating: boolean) => void;
}

/**
 * Global state store for the public Maps-review session.
 *
 * @remarks
 * This identity is separate from the employee authentication store. State hydration
 * depends on the cookie-backed `reviewerAuthApi.getCurrentReviewer` request.
 */
export const useReviewerAuthStore = create<ReviewerAuthState>((set) => ({
  reviewer: null,
  isAuthenticated: false,
  isHydrating: true,
  login: (reviewer): void => {
    set({ reviewer, isAuthenticated: true, isHydrating: false });
  },
  logout: (): void => {
    set({ reviewer: null, isAuthenticated: false, isHydrating: false });
  },
  setHydrating: (isHydrating): void => set({ isHydrating }),
}));
