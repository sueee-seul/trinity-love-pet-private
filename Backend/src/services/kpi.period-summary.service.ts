import {
  getKpiMongoConnection,
  isKpiMongoConfigured,
} from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { getReportLogModel } from '../mongodb/kpi-reports/report-log.model.js';
import { toAucklandDateString } from './kpi.daily-summary.service.js';
import type { KeyNumberChange } from './kpi.report.compare.js';
import {
  formatPeriodLabel,
  lastCompletedPeriod,
  type KpiReportType,
  type ReportPeriod,
} from './kpi.report.periods.js';

/*
 * The summary card for the 7d / 30d / 90d tabs: the saved report of the last completed week
 * (Monday to Sunday), month or quarter. It never calls the LLM. The reports job writes each report
 * once, so every day of the following period shows the same saved text.
 */
export const PERIOD_SUMMARY_RANGES = ['7d', '30d', '90d'] as const;
export type PeriodSummaryRange = (typeof PERIOD_SUMMARY_RANGES)[number];

const REPORT_TYPE_BY_RANGE: Record<PeriodSummaryRange, KpiReportType> = {
  '7d': 'weekly',
  '30d': 'monthly',
  '90d': 'quarterly',
};

interface PeriodSummaryBase {
  range: PeriodSummaryRange;
  type: KpiReportType;
  period: ReportPeriod;
  periodLabel: string;
}

export type PeriodSummaryView = PeriodSummaryBase &
  (
    | { status: 'ready'; reportId: string; headline: string; keyNumbers: KeyNumberChange[] }
    /** The report exists but its LLM call failed; the figures are still there. */
    | { status: 'no_text'; reportId: string; headline: null; keyNumbers: KeyNumberChange[] }
    | { status: 'not_ready'; reportId: null; headline: null; keyNumbers: [] }
  );

export const readPeriodSummary = async (
  range: PeriodSummaryRange,
  now: Date = new Date(),
): Promise<PeriodSummaryView> => {
  const type = REPORT_TYPE_BY_RANGE[range];
  const period = lastCompletedPeriod(type, toAucklandDateString(now));
  const base: PeriodSummaryBase = {
    range,
    type,
    period,
    periodLabel: formatPeriodLabel(type, period),
  };
  const notReady: PeriodSummaryView = {
    ...base,
    status: 'not_ready',
    reportId: null,
    headline: null,
    keyNumbers: [],
  };
  if (!isKpiMongoConfigured()) {
    return notReady;
  }

  const ReportLog = getReportLogModel(await getKpiMongoConnection());
  // Every report for exactly this period, scheduled or manual, newest first.
  const reports = await ReportLog.find({ type, periodStart: period.start, periodEnd: period.end })
    .sort({ createdAt: -1 })
    .lean();
  // Prefer a report whose LLM text was written over one whose LLM call failed.
  const report = reports.find((candidate) => candidate.content.headline) ?? reports[0];
  if (!report) {
    return notReady;
  }
  const reportId = String(report._id);
  const { headline, keyNumbers } = report.content;
  return headline
    ? { ...base, status: 'ready', reportId, headline, keyNumbers }
    : { ...base, status: 'no_text', reportId, headline: null, keyNumbers };
};
