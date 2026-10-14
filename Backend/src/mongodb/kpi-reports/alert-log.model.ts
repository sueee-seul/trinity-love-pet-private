import { Schema, type Connection, type Model } from 'mongoose';
import { KPI_ALERT_RULES, type KpiAlertRule } from '../../services/kpi.alerts.rules.js';

/** One raised alert. A rule + subject repeats on the same date only when it got worse. */
export interface AlertLogDocument {
  /** Auckland date of the check (YYYY-MM-DD). */
  date: string;
  rule: KpiAlertRule;
  subject: string;
  severity: number;
  title: string;
  body: string;
  /** User ids of managers who have read it; read state is per manager. */
  readBy: string[];
  /** Set for "report ready" alerts: the report to open. */
  reportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const alertLogSchema = new Schema<AlertLogDocument>(
  {
    date: { type: String, required: true },
    rule: { type: String, required: true, enum: KPI_ALERT_RULES },
    subject: { type: String, required: true },
    severity: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    readBy: { type: [String], default: [] },
    reportId: { type: String, default: null },
  },
  { collection: 'alert_logs', timestamps: true, versionKey: false },
);

alertLogSchema.index({ date: 1, rule: 1, subject: 1, createdAt: -1 });

/** Registers the model on the KPI reports connection only. */
export const getAlertLogModel = (connection: Connection): Model<AlertLogDocument> =>
  (connection.models.KpiAlertLog as Model<AlertLogDocument> | undefined) ??
  connection.model<AlertLogDocument>('KpiAlertLog', alertLogSchema);
