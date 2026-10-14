import { getDailySummaryModel } from '../mongodb/kpi-reports/daily-summary.model.js';
import {
  getKpiMongoConnection,
  isKpiMongoConfigured,
} from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { readKpiLlmSettings, writeDailySummaryText } from './kpi.llm.service.js';
import { addDays, buildDailyKpiFigures, type DailyKpiFigures } from './kpi.summary.service.js';

/** A failed summary is retried on later job runs until it has used this many attempts. */
export const MAX_DAILY_SUMMARY_ATTEMPTS = 3;

/** Today's date (YYYY-MM-DD) in Pacific/Auckland. */
export const toAucklandDateString = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/** Current hour (0-23) in Pacific/Auckland. */
export const toAucklandHour = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .find((part) => part.type === 'hour')?.value,
  );

export const getYesterdayInAuckland = (now: Date): string => addDays(toAucklandDateString(now), -1);

export type DailySummaryRunResult = 'created' | 'skipped';

/**
 * Creates the summary for `date` once. Skips when a ready or empty summary exists, or a failed one
 * has used all attempts. Saves "empty" without calling the LLM when nothing was scheduled.
 */
export const generateDailySummary = async (
  date: string,
  now: Date = new Date(),
): Promise<DailySummaryRunResult> => {
  const DailySummary = getDailySummaryModel(await getKpiMongoConnection());
  const existing = await DailySummary.findOne({ date }).lean();
  if (
    existing &&
    (existing.status !== 'failed' || existing.attempts >= MAX_DAILY_SUMMARY_ATTEMPTS)
  ) {
    return 'skipped';
  }

  const figures = await buildDailyKpiFigures(date, now);
  if (figures.scheduled === 0) {
    await DailySummary.updateOne(
      { date },
      { $set: { status: 'empty', text: null, figures, llmModel: null, attempts: 0 } },
      { upsert: true },
    );
    return 'created';
  }

  // Missing LLM settings are not an attempt: nothing is saved, so the next run tries again
  // once the settings are added.
  readKpiLlmSettings();

  const attempts = (existing?.attempts ?? 0) + 1;
  try {
    const { text, model } = await writeDailySummaryText(figures);
    await DailySummary.updateOne(
      { date },
      { $set: { status: 'ready', text, figures, llmModel: model, attempts } },
      { upsert: true },
    );
  } catch (error: unknown) {
    await DailySummary.updateOne(
      { date },
      { $set: { status: 'failed', text: null, figures, llmModel: null, attempts } },
      { upsert: true },
    );
    throw error;
  }
  return 'created';
};

export type DailySummaryView =
  | { date: string; status: 'ready'; text: string; figures: DailyKpiFigures }
  | { date: string; status: 'empty'; text: null; figures: DailyKpiFigures }
  | { date: string; status: 'not_ready'; text: null; figures: null };

/** Reads yesterday's saved summary and its figures for the dashboard card. Never calls the LLM. */
export const readYesterdaySummary = async (now: Date = new Date()): Promise<DailySummaryView> => {
  const date = getYesterdayInAuckland(now);
  if (!isKpiMongoConfigured()) {
    return { date, status: 'not_ready', text: null, figures: null };
  }
  const DailySummary = getDailySummaryModel(await getKpiMongoConnection());
  const saved = await DailySummary.findOne({ date }).lean();
  if (saved?.status === 'ready' && saved.text) {
    return { date, status: 'ready', text: saved.text, figures: saved.figures };
  }
  if (saved?.status === 'empty') {
    return { date, status: 'empty', text: null, figures: saved.figures };
  }
  return { date, status: 'not_ready', text: null, figures: null };
};
