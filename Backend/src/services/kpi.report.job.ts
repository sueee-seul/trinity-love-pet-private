import { isKpiMongoConfigured } from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { toAucklandDateString, toAucklandHour } from './kpi.daily-summary.service.js';
import { KPI_REPORT_TYPES, lastCompletedPeriod } from './kpi.report.periods.js';
import { generateKpiReport, hasScheduledReport } from './kpi.report.service.js';

/*
 * Runs inside the API server like the other jobs: every 15 minutes, and once shortly after start.
 * From 09:00 Auckland it creates last week's report (Monday), last month's report (the 1st) and
 * last quarter's report (1 Jan, 1 Apr, 1 Jul, 1 Oct) if they are not saved yet, so a restart
 * catches up. KPI_REPORTS_JOB=off keeps this server out.
 */
export const KPI_REPORTS_JOB_INTERVAL_MS = 15 * 60_000;
const FIRST_RUN_DELAY_MS = 60_000;
export const REPORT_HOUR = 9;

export interface KpiReportsJobDependencies {
  hasScheduledReport: typeof hasScheduledReport;
  generateKpiReport: typeof generateKpiReport;
}

/** One run of the job, never two at once. Failures are logged and the next run tries again. */
export const createKpiReportsTick = (
  dependencies: KpiReportsJobDependencies = { hasScheduledReport, generateKpiReport },
): ((now?: Date) => Promise<void>) => {
  let running = false;
  return async (now: Date = new Date()): Promise<void> => {
    if (running || toAucklandHour(now) < REPORT_HOUR) {
      return;
    }
    running = true;
    try {
      const today = toAucklandDateString(now);
      for (const type of KPI_REPORT_TYPES) {
        const period = lastCompletedPeriod(type, today);
        if (!(await dependencies.hasScheduledReport(type, period))) {
          await dependencies.generateKpiReport(type, period, 'schedule', now);
        }
      }
    } catch (error: unknown) {
      console.error('KPI reports job failed', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
};

export const startKpiReportsJob = (): void => {
  if (process.env.KPI_REPORTS_JOB === 'off') {
    return;
  }
  if (!isKpiMongoConfigured()) {
    console.info('KPI reports job is off: KPI_MONGO_URI is not set');
    return;
  }
  const tick = createKpiReportsTick();
  setTimeout(() => void tick(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void tick(), KPI_REPORTS_JOB_INTERVAL_MS).unref();
};
