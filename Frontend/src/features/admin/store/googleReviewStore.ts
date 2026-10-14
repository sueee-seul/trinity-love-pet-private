import { useEffect } from 'react';
import { create } from 'zustand';
import { googleReviewsApi } from '../api/googleReviewsApi';
import type { AdminGoogleReview, AdminGoogleReviewPage } from '../types/googleReview';
import { subscribeToGoogleReviewServerEvents } from '../../../shared/events/googleReviewServerEvents';
import { loadGoogleReviewNotifications } from './googleReviewNotificationStore';

const GOOGLE_REVIEW_PLACE_SLUG = 'PetHouse';
const GOOGLE_REVIEW_LOAD_ERROR = 'Reviews could not be loaded. Please try again.';

/** Lifecycle of the employee Google Review page snapshot. */
export type GoogleReviewSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

interface GoogleReviewStoreState {
  reviewPage: AdminGoogleReviewPage | null;
  status: GoogleReviewSnapshotStatus;
  error: string | null;
  setLoading: () => void;
  hydrateReviewPage: (reviewPage: AdminGoogleReviewPage) => void;
  replaceReview: (review: AdminGoogleReview) => void;
  setError: (message: string) => void;
}

/** Reactive Google Review state exposed to page and panel consumers. */
export interface GoogleReviewsState {
  reviewPage: AdminGoogleReviewPage | null;
  status: GoogleReviewSnapshotStatus;
  error: string | null;
}

/** Zustand hook and imperative store for the employee Google Review page snapshot. */
export const useGoogleReviewStore = create<GoogleReviewStoreState>((set) => ({
  reviewPage: null,
  status: 'idle',
  error: null,
  setLoading: (): void => {
    set({ status: 'loading', error: null });
  },
  hydrateReviewPage: (reviewPage): void => {
    set({ reviewPage, status: 'ready', error: null });
  },
  replaceReview: (updatedReview): void => {
    set((state) => {
      if (!state.reviewPage) {
        return state;
      }

      return {
        reviewPage: {
          ...state.reviewPage,
          reviews: state.reviewPage.reviews.map((review) =>
            review.id === updatedReview.id ? updatedReview : review,
          ),
        },
      };
    });
  },
  setError: (message): void => {
    set({ status: 'error', error: message });
  },
}));

let activeGoogleReviewRequest: Promise<void> | null = null;

/** Loads the fixed PetHouse employee review page, sharing any in-flight request. */
export const loadGoogleReviewPage = async (force = false): Promise<void> => {
  const state = useGoogleReviewStore.getState();
  if (!force && state.status === 'ready') {
    return;
  }

  if (activeGoogleReviewRequest) {
    return activeGoogleReviewRequest;
  }

  const isBackgroundRefresh = force && state.reviewPage !== null;
  if (!isBackgroundRefresh) {
    state.setLoading();
  }

  const setRequestError = (message: string): void => {
    const currentState = useGoogleReviewStore.getState();
    if (isBackgroundRefresh && currentState.reviewPage !== null) {
      useGoogleReviewStore.setState({ error: message });
      return;
    }
    currentState.setError(message);
  };

  activeGoogleReviewRequest = googleReviewsApi
    .getReviews(GOOGLE_REVIEW_PLACE_SLUG)
    .then((result) => {
      if (!result.ok || !result.data) {
        setRequestError(result.message ?? GOOGLE_REVIEW_LOAD_ERROR);
        return;
      }

      useGoogleReviewStore.getState().hydrateReviewPage(result.data);
    })
    .catch(() => {
      setRequestError(GOOGLE_REVIEW_LOAD_ERROR);
    })
    .finally(() => {
      activeGoogleReviewRequest = null;
    });

  return activeGoogleReviewRequest;
};

/** Keeps the review snapshot and manager notifications current from the ordinary review stream. */
export const useGoogleReviewStoreSync = (isManager = false): void => {
  useEffect(() => {
    return subscribeToGoogleReviewServerEvents('admin', GOOGLE_REVIEW_PLACE_SLUG, {
      onRefresh: () => {
        void loadGoogleReviewPage(true);
      },
      onChange: (event) => {
        if (isManager && event.changeType === 'created') {
          void loadGoogleReviewNotifications(true);
        }
      },
    });
  }, [isManager]);
};

/** Reads the reactive review snapshot and starts its initial load on mount. */
export const useGoogleReviews = (): GoogleReviewsState => {
  const reviewPage = useGoogleReviewStore((state) => state.reviewPage);
  const status = useGoogleReviewStore((state) => state.status);
  const error = useGoogleReviewStore((state) => state.error);

  useEffect(() => {
    void loadGoogleReviewPage();
  }, []);

  return { reviewPage, status, error };
};

/** Clears the Google Review snapshot and request state on logout/session reset. */
export const resetGoogleReviewStore = (): void => {
  useGoogleReviewStore.setState({ reviewPage: null, status: 'idle', error: null });
};
