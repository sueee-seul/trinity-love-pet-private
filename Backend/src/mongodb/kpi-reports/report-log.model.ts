import { Schema, type Connection, type Model } from 'mongoose';
import { KPI_REPORT_TYPES, type KpiReportType } from '../../services/kpi.report.periods.js';
import type { KpiReportContent } from '../../services/kpi.report.service.js';
import type { ReportEmailLog } from '../../services/kpi.report.email.sender.js';

export type ReportTrigger = 'schedule' | 'manual';

/** One generated weekly, monthly or quarterly report. Scheduled reports run once per period. */
export interface ReportLogDocument {
  type: KpiReportType;
  periodStart: string;
  periodEnd: string;
  trigger: ReportTrigger;
  content: KpiReportContent;
  llmModel: string | null;
  llmError: string | null;
  /** What happened to the email; null until a send was attempted. */
  email: ReportEmailLog | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportLogSchema = new Schema<ReportLogDocument>(
  {
    type: { type: String, required: true, enum: [...KPI_REPORT_TYPES] },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    trigger: { type: String, required: true, enum: ['schedule', 'manual'] },
    content: { type: Schema.Types.Mixed, required: true },
    llmModel: { type: String, default: null },
    llmError: { type: String, default: null },
    email: { type: Schema.Types.Mixed, default: null },
  },
  { collection: 'report_logs', timestamps: true, versionKey: false },
);

reportLogSchema.index({ type: 1, periodStart: 1, trigger: 1 });

/** Registers the model on the KPI reports connection only. */
export const getReportLogModel = (connection: Connection): Model<ReportLogDocument> =>
  (connection.models.KpiReportLog as Model<ReportLogDocument> | undefined) ??
  connection.model<ReportLogDocument>('KpiReportLog', reportLogSchema);
