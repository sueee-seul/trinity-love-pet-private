import { Types } from 'mongoose';
import { getAlertLogModel } from '../mongodb/kpi-reports/alert-log.model.js';
import {
  getKpiMongoConnection,
  isKpiMongoConfigured,
} from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { getReportLogModel, type ReportTrigger } from '../mongodb/kpi-reports/report-log.model.js';
import {
  countTasksCreatedBetween,
  findManagerEmails,
  findReportTasksScheduledBetween,
} from '../repositories/kpi.report.repository.js';
import { toAucklandDateString } from './kpi.daily-summary.service.js';
import {
  compareKeyNumbers,
  findBiggestMovers,
  findTrendWarnings,
  TREND_PERIODS,
  type KeyNumberChange,
} from './kpi.report.compare.js';
import { buildReportFigures, type StaffReportFigure } from './kpi.report.figures.js';
import { writeKpiReport, type DelayReasonTheme } from './kpi.report.llm.js';
import {
  formatPeriodLabel,
  previousPeriod,
  REPORT_TYPE_LABELS,
  type KpiReportType,
  type ReportPeriod,
} from './kpi.report.periods.js';
import { toKpiCategory } from './kpi.service.js';
import { renderKpiReportEmail } from './kpi.report.email.render.js';
import {
  createReportEmailSender,
  readReportEmailSettings,
  resolveRecipients,
  type ReportEmailLog,
  type ReportEmailMode,
} from './kpi.report.email.sender.js';

/** Everything the report shows, saved once and shared by the email and the report page. */
export interface KpiReportContent {
  type: KpiReportType;
  period: ReportPeriod;
  periodLabel: string;
  previous: ReportPeriod;
  previousLabel: string;
  trends: string[];
  /** LLM headline; null when the LLM call failed. */
  headline: string | null;
  keyNumbers: KeyNumberChange[];
  movers: string[];
  staff: StaffReportFigure[];
  delayReasons: DelayReasonTheme[];
  delayReasonCount: number;
}

export interface BuiltKpiReport {
  content: KpiReportContent;
  llmModel: string | null;
  llmError: string | null;
}

/** The trend window: TREND_PERIODS periods ending with `period`, oldest first. */
const periodsEndingWith = (type: KpiReportType, period: ReportPeriod): ReportPeriod[] => {
  const periods = [period];
  while (periods.length < TREND_PERIODS) {
    const oldest = periods[0];
    if (!oldest) {
      break;
    }
    periods.unshift(previousPeriod(type, oldest));
  }
  return periods;
};

export const buildKpiReport = async (
  type: KpiReportType,
  period: ReportPeriod,
  now: Date = new Date(),
): Promise<BuiltKpiReport> => {
  const loaded = await Promise.all(
    periodsEndingWith(type, period).map(async (window) => {
      const [tasks, created] = await Promise.all([
        findReportTasksScheduledBetween(window.start, window.end),
        countTasksCreatedBetween(window.start, window.end),
      ]);
      return { tasks, figures: buildReportFigures(tasks, created, now) };
    }),
  );
  const current = loaded.at(-1);
  const before = loaded.at(-2);
  if (!current || !before) {
    throw new Error('A KPI report needs the current and the previous period');
  }

  const previous = previousPeriod(type, period);
  const keyNumbers = compareKeyNumbers(current.figures, before.figures);
  const trends = findTrendWarnings(
    loaded.map(({ figures }) => figures),
    type,
  );
  const movers = findBiggestMovers(current.figures, before.figures);
  const reasons = current.tasks.flatMap((task) => {
    const reason = task.issue?.trim();
    return reason ? [{ category: toKpiCategory(task), reason }] : [];
  });
  const periodLabel = formatPeriodLabel(type, period);

  let headline: string | null = null;
  let delayReasons: DelayReasonTheme[] = [];
  let llmModel: string | null = null;
  let llmError: string | null = null;
  try {
    const writing = await writeKpiReport({
      type,
      periodLabel,
      keyNumbers,
      trends,
      movers,
      delayReasons: reasons,
    });
    headline = writing.headline;
    delayReasons = writing.delayReasons;
    llmModel = writing.model;
  } catch (error: unknown) {
    llmError = error instanceof Error ? error.message : String(error);
  }

  return {
    content: {
      type,
      period,
      periodLabel,
      previous,
      previousLabel: formatPeriodLabel(type, previous),
      trends,
      headline,
      keyNumbers,
      movers,
      staff: current.figures.staff,
      delayReasons,
      delayReasonCount: reasons.length,
    },
    llmModel,
    llmError,
  };
};

/**
 * Emails a saved report to the managers, or only to KPI_REPORT_TEST_RECIPIENT when it is set.
 * Never throws: the outcome is returned so it can be saved on the report.
 */
const sendKpiReportEmail = async (
  reportId: string,
  content: KpiReportContent,
): Promise<ReportEmailLog> => {
  let mode: ReportEmailMode = 'console';
  let managers: string[] = [];
  try {
    const settings = readReportEmailSettings();
    mode = settings.mode;
    managers = await findManagerEmails();
    const sentTo = resolveRecipients(managers, settings.testRecipient);
    if (sentTo.length === 0) {
      return {
        mode,
        intendedRecipients: managers,
        sentTo,
        status: 'skipped',
        sentAt: null,
        error: 'No recipients',
      };
    }
    const rendered = renderKpiReportEmail(content, {
      reportUrl: `${settings.appUrl}/admin/kpi-reports/${reportId}`,
      intendedRecipients: settings.testRecipient ? managers : null,
    });
    await createReportEmailSender(settings)({ to: sentTo, ...rendered });
    return {
      mode,
      intendedRecipients: managers,
      sentTo,
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: null,
    };
  } catch (error: unknown) {
    return {
      mode,
      intendedRecipients: managers,
      sentTo: [],
      status: 'failed',
      sentAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/** Builds and saves a report, adds a "report ready" alert that links to it, then emails it. */
export const generateKpiReport = async (
  type: KpiReportType,
  period: ReportPeriod,
  trigger: ReportTrigger,
  now: Date = new Date(),
): Promise<string> => {
  const { content, llmModel, llmError } = await buildKpiReport(type, period, now);
  const connection = await getKpiMongoConnection();
  const ReportLog = getReportLogModel(connection);
  const report = await ReportLog.create({
    type,
    periodStart: period.start,
    periodEnd: period.end,
    trigger,
    content,
    llmModel,
    llmError,
    email: null,
  });
  const reportId = String(report._id);
  await getAlertLogModel(connection).create({
    date: toAucklandDateString(now),
    rule: 'report-ready',
    subject: reportId,
    severity: 1,
    title: `${REPORT_TYPE_LABELS[type]} report ready (${content.periodLabel})`,
    body: content.headline ?? 'Open the report to see the figures for this period.',
    readBy: [],
    reportId,
  });
  const email = await sendKpiReportEmail(reportId, content);
  await ReportLog.updateOne({ _id: report._id }, { $set: { email } });
  return reportId;
};

/** Whether the scheduled report for this period has already been generated. */
export const hasScheduledReport = async (
  type: KpiReportType,
  period: ReportPeriod,
): Promise<boolean> => {
  const ReportLog = getReportLogModel(await getKpiMongoConnection());
  return (
    (await ReportLog.exists({ type, periodStart: period.start, trigger: 'schedule' })) !== null
  );
};

export interface KpiReportView {
  id: string;
  trigger: ReportTrigger;
  createdAt: string;
  content: KpiReportContent;
}

export const findKpiReport = async (reportId: string): Promise<KpiReportView | null> => {
  if (!isKpiMongoConfigured() || !Types.ObjectId.isValid(reportId)) {
    return null;
  }
  const ReportLog = getReportLogModel(await getKpiMongoConnection());
  const report = await ReportLog.findById(reportId).lean();
  if (!report) {
    return null;
  }
  return {
    id: reportId,
    trigger: report.trigger,
    createdAt: new Date(report.createdAt).toISOString(),
    content: report.content,
  };
};
