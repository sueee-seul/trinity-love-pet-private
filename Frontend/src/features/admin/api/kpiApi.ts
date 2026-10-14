import { API_BASE_URL } from '../../../shared/api';
import type { KpiMockData, KpiRange } from '../hooks/useKpiDashboard.js';
import { generateKpiMockData } from '../components/operation/mock/kpiMockData.js';

/**
 * Fetches KPI dashboard data from the Backend API.
 * The period is always `'today'`; the range controls how many days
 * of history are returned (1/7/30/90 days ending today).
 *
 * Falls back to mock data when the API responds with an error or
 * the response body is missing the expected `series` object.
 *
 * @param range - The date range to fetch ('today' | '7d' | '30d' | '90d').
 * @returns A `KpiMockData` object containing all chart series.
 */
interface KpiApiResponse {
  code: number;
  msg: string;
  data: {
    period: string;
    charts: Array<{ id: string; title: string }>;
    series: {
      completedRate: Array<{ label: string; value: number | null }>;
      overdueComposition: Array<{
        label: string;
        completedOnTime: number;
        ongoing: number;
        overdue: number;
      }>;
      avgCompletionTime: Array<{ label: string; value: number }>;
      overdueRate: Array<{ label: string; primary: number; secondary: number }>;
      completionTrend: Array<{ label: string; value: number }>;
      categoryDistribution: Array<{ label: string; value: number }>;
      priorityBreakdown: Array<{ label: string; value: number }>;
      tasksPerEmployee: Array<{ label: string; value: number }>;
      statusOverview: Array<{ label: string; value: number }>;
      scheduledVsCompleted: Array<{ label: string; primary: number; secondary: number }>;
      avgDelayTime: Array<{ label: string; value: number }>;
      tasksByPet: Array<{ label: string; value: number }>;
      taskTypeComparison: Array<{ label: string; primary: number; secondary: number }>;
      creationTrend: Array<{ label: string; value: number }>;
      completionEfficiencyByPriority: Array<{
        label: string;
        high: number;
        medium: number;
        low: number;
      }>;
    };
  };
}

export const fetchKpiDashboard = async (range: KpiRange = 'today'): Promise<KpiMockData> => {
  const params = new URLSearchParams({
    period: 'today',
    range,
  });

  const response = await fetch(`${API_BASE_URL}/admin/kpi/dashboard?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return generateKpiMockData(range);
  }

  const result: KpiApiResponse = await response.json();
  const series = result.data?.series;

  if (!series) {
    return generateKpiMockData(range);
  }

  return {
    completionTrend: series.completionTrend,
    overdueRate: series.overdueRate,
    avgCompletionTime: series.avgCompletionTime,
    categoryDistribution: series.categoryDistribution,
    priorityBreakdown: series.priorityBreakdown,
    tasksPerEmployee: series.tasksPerEmployee,
    statusOverview: series.statusOverview,
    scheduledVsCompleted: series.scheduledVsCompleted,
    avgDelayTime: series.avgDelayTime,
    tasksByPet: series.tasksByPet,
    taskTypeComparison: series.taskTypeComparison,
    creationTrend: series.creationTrend,
    completionEfficiencyByPriority: series.completionEfficiencyByPriority,
  };
};

/** Figures behind yesterday's summary; mirrors DailyKpiFigures in Backend kpi.summary.service.ts. */
export interface KpiDailySummaryFigures {
  date: string;
  scheduled: number;
  completed: number;
  completionRate: number;
  overdue: number;
  incompleteAtDayEnd: number;
  staff: Array<{ name: string; overdue: number; assigned: number }>;
}

/** Yesterday's saved summary; mirrors DailySummaryView in Backend kpi.daily-summary.service.ts. */
export type KpiDailySummary =
  | { date: string; status: 'ready'; text: string; figures: KpiDailySummaryFigures }
  | { date: string; status: 'empty'; text: null; figures: KpiDailySummaryFigures }
  | { date: string; status: 'not_ready'; text: null; figures: null };

interface KpiDailySummaryResponse {
  code: number;
  msg: string;
  data: KpiDailySummary;
}

/** Fetches yesterday's saved KPI summary. The Backend never calls the LLM for this request. */
export const fetchKpiDailySummary = async (): Promise<KpiDailySummary> => {
  const response = await fetch(`${API_BASE_URL}/admin/kpi/daily-summary`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`KPI daily summary request failed: ${response.status}`);
  }
  const result: KpiDailySummaryResponse = await response.json();
  return result.data;
};
