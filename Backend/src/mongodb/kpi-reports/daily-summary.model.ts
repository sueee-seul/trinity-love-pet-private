import { Schema, type Connection, type Model } from 'mongoose';
import type { DailyKpiFigures } from '../../services/kpi.summary.service.ts';

export type DailySummaryStatus = 'ready' | 'empty' | 'failed';

/** One Auckland day's summary. `date` is unique, so a day is generated at most once. */
export interface DailySummaryDocument {
  date: string;
  status: DailySummaryStatus;
  text: string | null;
  figures: DailyKpiFigures;
  llmModel: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const dailySummarySchema = new Schema<DailySummaryDocument>(
  {
    date: { type: String, required: true, unique: true },
    status: { type: String, required: true, enum: ['ready', 'empty', 'failed'] },
    text: { type: String, default: null },
    figures: { type: Schema.Types.Mixed, required: true },
    llmModel: { type: String, default: null },
    attempts: { type: Number, required: true, default: 0 },
  },
  { collection: 'daily_summaries', timestamps: true, versionKey: false },
);

/** Registers the model on the KPI reports connection only (not the global mongoose registry). */
export const getDailySummaryModel = (connection: Connection): Model<DailySummaryDocument> =>
  (connection.models.KpiDailySummary as Model<DailySummaryDocument> | undefined) ??
  connection.model<DailySummaryDocument>('KpiDailySummary', dailySummarySchema);
