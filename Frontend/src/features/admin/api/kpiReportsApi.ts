import { API_BASE_URL } from '../../../shared/api';

/** Mirrors KeyNumberChange in Backend kpi.report.compare.ts. */
export interface KpiReportKeyNumber {
  key: string;
  label: string;
  unit: '%' | 'm' | '';
  current: number | null;
  previous: number | null;
  change: number | null;
  worse: boolean;
}

/** Mirrors KpiReportContent in Backend kpi.report.service.ts. */
export interface KpiReportContent {
  type: 'weekly' | 'monthly' | 'quarterly';
  period: { start: string; end: string };
  periodLabel: string;
  previous: { start: string; end: string };
  previousLabel: string;
  trends: string[];
  headline: string | null;
  keyNumbers: KpiReportKeyNumber[];
  movers: string[];
  staff: Array<{
    name: string;
    scheduled: number;
    completed: number;
    completionRate: number | null;
    overdue: number;
  }>;
  delayReasons: Array<{ theme: string; count: number; example: string }>;
  delayReasonCount: number;
}

/** Mirrors KpiReportView in Backend kpi.report.service.ts. */
export interface KpiReport {
  id: string;
  trigger: 'schedule' | 'manual';
  createdAt: string;
  content: KpiReportContent;
}

interface KpiReportResponse {
  code: number;
  msg: string;
  data: KpiReport;
}

/** Loads one saved report; null when it does not exist. */
export const fetchKpiReport = async (reportId: string): Promise<KpiReport | null> => {
  const response = await fetch(
    `${API_BASE_URL}/admin/kpi-reports/${encodeURIComponent(reportId)}`,
    { credentials: 'include' },
  );
  if (response.status === 404 || response.status === 400) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`KPI report request failed: ${response.status}`);
  }
  const result: KpiReportResponse = await response.json();
  return result.data;
};
