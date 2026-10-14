import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGoogleReviewDashboard } from '../api/googleReviewDashboardApi';
import {
  GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
  type GoogleReviewDashboardQuery,
  type GoogleReviewDashboardState,
  type GoogleReviewDashboardStatus,
} from '../types/googleReviewDashboard';

interface UseAdminGoogleReviewDashboardOptions {
  from?: string;
  to?: string;
}

export const useAdminGoogleReviewDashboard = ({
  from,
  to,
}: UseAdminGoogleReviewDashboardOptions = {}): GoogleReviewDashboardState => {
  const [dashboard, setDashboard] = useState<GoogleReviewDashboardState['dashboard']>(null);
  const [status, setStatus] = useState<GoogleReviewDashboardStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const hasDashboardRef = useRef(false);
  const refresh = useCallback((): void => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query: GoogleReviewDashboardQuery = {
      placeSlug: GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
    setStatus(hasDashboardRef.current ? 'refreshing' : 'loading');
    setError(null);

    void fetchGoogleReviewDashboard(query, controller.signal)
      .then((nextDashboard) => {
        if (controller.signal.aborted) {
          return;
        }
        hasDashboardRef.current = true;
        setDashboard(nextDashboard);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus('error');
        setError(
          caught instanceof Error ? caught.message : 'Google review dashboard failed to load.',
        );
      });

    return (): void => {
      controller.abort();
    };
  }, [from, refreshVersion, to]);

  return {
    dashboard,
    status,
    error,
    refresh,
  };
};
