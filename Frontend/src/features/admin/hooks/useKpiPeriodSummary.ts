import { useEffect, useState } from 'react';
import {
  fetchKpiPeriodSummary,
  type KpiPeriodSummary,
  type KpiPeriodSummaryRange,
} from '../api/kpiPeriodSummaryApi.js';

export type KpiPeriodSummaryLoadStatus = 'loading' | 'loaded' | 'error';

interface LoadedPeriodSummary {
  range: KpiPeriodSummaryRange;
  summary: KpiPeriodSummary | null;
  failed: boolean;
}

/** Loads the saved summary for the selected tab; it reloads only when the tab changes. */
export const useKpiPeriodSummary = (
  range: KpiPeriodSummaryRange,
): { summary: KpiPeriodSummary | null; loadStatus: KpiPeriodSummaryLoadStatus } => {
  const [loaded, setLoaded] = useState<LoadedPeriodSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetchKpiPeriodSummary(range)
      .then((summary) => {
        if (active) {
          setLoaded({ range, summary, failed: false });
        }
      })
      .catch(() => {
        if (active) {
          setLoaded({ range, summary: null, failed: true });
        }
      });
    return (): void => {
      active = false;
    };
  }, [range]);

  // A result for another tab is stale until this tab's request finishes.
  const current = loaded?.range === range ? loaded : null;
  if (current === null) {
    return { summary: null, loadStatus: 'loading' };
  }
  return { summary: current.summary, loadStatus: current.failed ? 'error' : 'loaded' };
};
