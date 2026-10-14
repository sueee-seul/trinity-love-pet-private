import { isKpiMongoConfigured } from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { generateDailySummary, getYesterdayInAuckland } from './kpi.daily-summary.service.js';

/*
 * Runs inside the API server like the booking job: every 15 minutes, and once shortly after start.
 * From 06:00 Auckland it creates yesterday's summary if it is not saved yet, so a restart or a
 * missed run catches up. KPI_SUMMARY_JOB=off, or no KPI_MONGO_URI, keeps this server out of it.
 */
export const KPI_SUMMARY_JOB_INTERVAL_MS = 15 * 60_000;
const FIRST_RUN_DELAY_MS = 60_000;
export const DAILY_SUMMARY_HOUR = 9;

const toAucklandHour = (now: Date): number => {
  const hour = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .find((part) => part.type === 'hour')?.value;
  return Number(hour);
};

type RunDailySummary = (date: string, now: Date) => Promise<unknown>;

/** One run of the job, never two at once. Failures are logged and the next run tries again. */
export const createDailySummaryTick = (
  runDailySummary: RunDailySummary = generateDailySummary,
): ((now?: Date) => Promise<void>) => {
  let running = false;
  return async (now: Date = new Date()): Promise<void> => {
    if (running || toAucklandHour(now) < DAILY_SUMMARY_HOUR) {
      return;
    }
    running = true;
    try {
      await runDailySummary(getYesterdayInAuckland(now), now);
    } catch (error: unknown) {
      console.error('KPI daily summary job failed', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
};

export const startKpiDailySummaryJob = (): void => {
  if (process.env.KPI_SUMMARY_JOB === 'off') {
    return;
  }
  if (!isKpiMongoConfigured()) {
    console.info('KPI daily summary job is off: KPI_MONGO_URI is not set');
    return;
  }
  const tick = createDailySummaryTick();
  setTimeout(() => void tick(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void tick(), KPI_SUMMARY_JOB_INTERVAL_MS).unref();
};
