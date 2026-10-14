import { useCallback, useEffect, useRef } from 'react';
import { reviewerAuthApi, type ReviewerProfile } from '../api/reviewerAuthApi';
import { useReviewerAuthStore } from '../store/reviewerAuthStore';

/** The outcome of a reviewer Google login attempt. */
interface ReviewerLoginResult {
  success: boolean;
  reviewer: ReviewerProfile | null;
  /** Optional error message mapped from the server response if authentication failed. */
  message?: string;
}

interface UseReviewerAuthOptions {
  /** Enables or disables the automatic hydration request on mount. Default is true. */
  hydrateOnMount?: boolean;
}

interface ReviewerAuthHook {
  /** The current hydrated reviewer profile if authenticated. */
  reviewer: ReviewerProfile | null;
  /** True if the reviewer is fully logged in. */
  isAuthenticated: boolean;
  /** True while the initial cookie-backed hydration request is pending. */
  isHydrating: boolean;

  /** Triggers the hydration flow and returns the resolved profile or null. */
  hydrate: () => Promise<ReviewerProfile | null>;
  /** Completes the OAuth flow, updates state, and returns the login outcome. */
  loginWithGoogleCode: (authorizationCode: string) => Promise<ReviewerLoginResult>;
  /** Clears the session on both the server and client store. */
  logout: () => Promise<void>;
}

/**
 * Exposes reviewer identity state and authentication actions for the Maps-review surface.
 *
 * @remarks
 * This identity is distinct from the employee portal session. Request deduplication
 * is implemented through `hydrationPromiseRef` so multiple mounts sharing the hook
 * will not trigger concurrent hydration requests.
 */
export function useReviewerAuth(options: UseReviewerAuthOptions = {}): ReviewerAuthHook {
  const reviewer = useReviewerAuthStore((state) => state.reviewer);
  const isAuthenticated = useReviewerAuthStore((state) => state.isAuthenticated);
  const isHydrating = useReviewerAuthStore((state) => state.isHydrating);
  const hydrationPromiseRef = useRef<Promise<ReviewerProfile | null> | null>(null);

  const hydrate = useCallback(async (): Promise<ReviewerProfile | null> => {
    // Request deduplication for concurrent hydration triggers.
    if (hydrationPromiseRef.current) {
      return hydrationPromiseRef.current;
    }

    const promise = (async (): Promise<ReviewerProfile | null> => {
      useReviewerAuthStore.getState().setHydrating(true);
      try {
        const result = await reviewerAuthApi.getCurrentReviewer();
        if (result.ok && result.data) {
          useReviewerAuthStore.getState().login(result.data);
          return result.data;
        }

        useReviewerAuthStore.getState().logout();
        return null;
      } catch {
        useReviewerAuthStore.getState().logout();
        return null;
      } finally {
        hydrationPromiseRef.current = null;
      }
    })();

    hydrationPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (options.hydrateOnMount === false) {
      return;
    }

    void hydrate();
  }, [hydrate, options.hydrateOnMount]);

  const loginWithGoogleCode = useCallback(
    async (authorizationCode: string): Promise<ReviewerLoginResult> => {
      try {
        const result = await reviewerAuthApi.loginWithGoogleCode(authorizationCode);
        if (result.ok && result.data) {
          useReviewerAuthStore.getState().login(result.data);
          return { success: true, reviewer: result.data };
        }

        return {
          success: false,
          reviewer: null,
          message: result.message ?? 'Google login failed. Please try again.',
        };
      } catch {
        return {
          success: false,
          reviewer: null,
          message: 'Google login failed. Please try again.',
        };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await reviewerAuthApi.logout();
    } finally {
      useReviewerAuthStore.getState().logout();
    }
  }, []);

  return {
    reviewer,
    isAuthenticated,
    isHydrating,
    hydrate,
    loginWithGoogleCode,
    logout,
  };
}
