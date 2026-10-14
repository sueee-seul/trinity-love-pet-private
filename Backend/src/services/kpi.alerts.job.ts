import { isKpiMongoConfigured } from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { runKpiAlertChecks } from './kpi.alerts.service.js';

/*
 * Runs inside the API server like the other jobs: every 30 minutes, and once shortly after start.
 * KPI_ALERTS_JOB=off, or no KPI_MONGO_URI, keeps this server out of it.
 */
export const KPI_ALERTS_JOB_INTERVAL_MS = 30 * 60_000;
const FIRST_RUN_DELAY_MS = 60_000;

type RunAlertChecks = (now: Date) => Promise<unknown>;

/** One run of the checks, never two at once. Failures are logged and the next run tries again. */
export const createKpiAlertsTick = (
  runChecks: RunAlertChecks = runKpiAlertChecks,
): ((now?: Date) => Promise<void>) => {
  let running = false;
  return async (now: Date = new Date()): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runChecks(now);
    } catch (error: unknown) {
      console.error('KPI alerts job failed', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
};

export const startKpiAlertsJob = (): void => {
  if (process.env.KPI_ALERTS_JOB === 'off') {
    return;
  }
  if (!isKpiMongoConfigured()) {
    console.info('KPI alerts job is off: KPI_MONGO_URI is not set');
    return;
  }
  const tick = createKpiAlertsTick();
  setTimeout(() => void tick(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void tick(), KPI_ALERTS_JOB_INTERVAL_MS).unref();
};
