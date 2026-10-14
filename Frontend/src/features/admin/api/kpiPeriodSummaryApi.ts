import { API_BASE_URL } from '../../../shared/api';
import type { KpiReportContent, KpiReportKeyNumber } from './kpiReportsApi';

export type KpiPeriodSummaryRange = '7d' | '30d' | '90d';

interface KpiPeriodSummaryBase {
  range: KpiPeriodSummaryRange;
  type: KpiReportContent['type'];
  period: { start: string; end: string };
  periodLabel: string;
}

/** Mirrors PeriodSummaryView in Backend kpi.period-summary.service.ts. */
export type KpiPeriodSummary = KpiPeriodSummaryBase &
  (
    | { status: 'ready'; reportId: string; headline: string; keyNumbers: KpiReportKeyNumber[] }
    | { status: 'no_text'; reportId: string; headline: null; keyNumbers: KpiReportKeyNumber[] }
    | { status: 'not_ready'; reportId: null; headline: null; keyNumbers: [] }
  );

interface KpiPeriodSummaryResponse {
  code: number;
  msg: string;
  data: KpiPeriodSummary;
}

/** Reads the saved report summary for a range tab. The Backend never calls the LLM for this. */
export const fetchKpiPeriodSummary = async (
  range: KpiPeriodSummaryRange,
): Promise<KpiPeriodSummary> => {
  const response = await fetch(`${API_BASE_URL}/admin/kpi/period-summary?range=${range}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`KPI period summary request failed: ${response.status}`);
  }
  const result: KpiPeriodSummaryResponse = await response.json();
  return result.data;
};
