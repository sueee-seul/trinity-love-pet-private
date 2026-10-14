import { useCallback, useEffect, useState } from 'react';
import { fetchStaffOverview } from '../api/staffDashboardApi';
import type { DashboardRange, StaffOverviewResult } from '../types/staffDashboard';

interface StaffOverviewState {
  data: StaffOverviewResult | null;
  loading: boolean;
  error: string | null;
  range: DashboardRange;
  setRange: (range: DashboardRange) => void;
  refresh: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: StaffOverviewResult }
  | { status: 'error'; message: string };

export const useStaffOverview = (initialRange: DashboardRange = 'today'): StaffOverviewState => {
  const [range, setRangeState] = useState<DashboardRange>(initialRange);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchStaffOverview(range)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((caught) => {
        if (cancelled) return;
        console.error('Failed to load the staff dashboard', caught);
        setState({
          status: 'error',
          message: 'Unable to load the staff dashboard. Please try again.',
        });
      });

    return (): void => {
      cancelled = true;
    };
  }, [range, reloadToken]);

  const setRange = useCallback((next: DashboardRange): void => {
    setState({ status: 'loading' });
    setRangeState(next);
  }, []);

  const refresh = useCallback((): void => {
    setState({ status: 'loading' });
    setReloadToken((token) => token + 1);
  }, []);

  return {
    data: state.status === 'ready' ? state.data : null,
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
    range,
    setRange,
    refresh,
  };
};
