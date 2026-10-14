import { useEffect, useState } from 'react';
import { fetchKpiDailySummary, type KpiDailySummary } from '../api/kpiApi.js';

export type KpiDailySummaryLoadStatus = 'loading' | 'loaded' | 'error';

export interface UseKpiDailySummaryResult {
  summary: KpiDailySummary | null;
  loadStatus: KpiDailySummaryLoadStatus;
}

/** Loads yesterday's saved summary once, for the Today tab. */
export const useKpiDailySummary = (): UseKpiDailySummaryResult => {
  const [summary, setSummary] = useState<KpiDailySummary | null>(null);
  const [loadStatus, setLoadStatus] = useState<KpiDailySummaryLoadStatus>('loading');

  useEffect(() => {
    let active = true;
    fetchKpiDailySummary()
      .then((data) => {
        if (active) {
          setSummary(data);
          setLoadStatus('loaded');
        }
      })
      .catch(() => {
        if (active) {
          setLoadStatus('error');
        }
      });
    return (): void => {
      active = false;
    };
  }, []);

  return { summary, loadStatus };
};
