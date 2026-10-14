import { useState, useCallback, useEffect } from 'react';
import { fetchKpiDashboard } from '../api/kpiApi.js';
import type { KpiMockData, KpiRange } from '../components/operation/mock/kpiMockData.js';

export type { KpiRange, KpiMockData };
export interface KpiChart {
  id: string;
  title: string;
}

export interface UseKpiDashboardResult {
  data: KpiMockData | null;
  status: 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
  range: KpiRange;
  setRange: (range: KpiRange) => void;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * React hook that manages KPI dashboard data, loading state, and the
 * selected time range.
 *
 * The dashboard always operates on today's data. The `range` state
 * ('today' | '7d' | '30d' | '90d') determines how many days of
 * history are shown. When the API fails, mock data is used as a fallback.
 */
export const useKpiDashboard = (): UseKpiDashboardResult => {
  const [data, setData] = useState<KpiMockData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'refreshing' | 'ready' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<KpiRange>('today');

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    setStatus((current) => (current === 'idle' ? 'loading' : 'refreshing'));

    try {
      const response = await fetchKpiDashboard(range);
      await delay(200);
      setData(response);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI dashboard');
      setStatus('error');
    }
  }, [range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return {
    data,
    status,
    error,
    refresh: load,
    range,
    setRange,
  };
};
