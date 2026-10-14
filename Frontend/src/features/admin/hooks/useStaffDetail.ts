import { useCallback, useEffect, useState } from 'react';
import { fetchStaffDetail } from '../api/staffDashboardApi';
import type { DashboardRange, StaffDetailResult } from '../types/staffDashboard';

interface StaffDetailState {
  data: StaffDetailResult | null;
  loading: boolean;
  error: string | null;
  range: DashboardRange;
  setRange: (range: DashboardRange) => void;
  refresh: () => void;
}

type LoadState =
  | { status: 'loading'; data: StaffDetailResult | null }
  | { status: 'ready'; data: StaffDetailResult }
  | { status: 'error'; message: string; data: StaffDetailResult | null };

export const useStaffDetail = (
  staffId: string,
  initialRange: DashboardRange = 'week',
): StaffDetailState => {
  const [range, setRangeState] = useState<DashboardRange>(initialRange);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;

    fetchStaffDetail(staffId, range)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((caught) => {
        if (cancelled) return;
        console.error('Failed to load the staff detail', caught);
        setState((prev) => ({
          status: 'error',
          message: 'Unable to load this staff member. Please try again.',
          data: prev.data,
        }));
      });
    return (): void => {
      cancelled = true;
    };
  }, [staffId, range, reloadToken]);

  const setRange = useCallback((next: DashboardRange): void => {
    setState((prev) => ({ status: 'loading', data: prev.data }));
    setRangeState(next);
  }, []);

  // In case a task is added automatically, trigger the useEffect again
  const refresh = useCallback((): void => {
    setState((prev) => ({ status: 'loading', data: prev.data }));
    setReloadToken((token) => token + 1);
  }, []);

  return {
    data: state.data,
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
    range,
    setRange,
    refresh,
  };
};
