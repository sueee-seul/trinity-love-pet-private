import {
  holdReminderStore,
  withBookingJobLock,
} from '../repositories/booking.hold-reminder.repository.js';
import { runBookingJobs, type BookingJobContext } from './booking.hold-reminder.js';
import { runReviewExpiryPass } from './booking.review-expiry.js';
import { runDailySummaryPass } from './daily-summary.service.js';
import { readEmailSetup } from './concierge/concierge.email.js';
import { readTeamContact } from './concierge/concierge.status.js';
import { getCardProcessor } from './payments/card-processor.factory.js';

/**
 * Starts the booking job inside the API server: every 15 minutes, and once shortly after start.
 * It needs no separate worker; the jobs lock keeps two servers from running it at once.
 * BOOKING_JOBS=off keeps this server out of it, e.g. a local server on a shared database.
 */

export const BOOKING_JOB_INTERVAL_MS = 15 * 60_000;
/** Lets the server finish starting before the first run. */
const FIRST_RUN_DELAY_MS = 60_000;

/** Postgres "undefined column" and "undefined table": the booking migration is not applied yet. */
const MISSING_SCHEMA_CODES = new Set(['42703', '42P01']);

const isMissingSchema = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  MISSING_SCHEMA_CODES.has(String(error.code));

export type BookingJobDependencies = Pick<BookingJobContext, 'emailSender' | 'contact'>;

/** Review deadlines first, so a request released now is not held or reminded about below. */
const runAllPasses = async (context: BookingJobContext): Promise<void> => {
  const review = await runReviewExpiryPass(context);
  if (Object.values(review).some((count) => count > 0)) {
    context.log(
      `Review job: ${review.expired} released, ${review.dueSoon} due soon, ${review.charged} charged, ${review.retryLater} for later`,
    );
  }
  await runBookingJobs(context);
  // From the update hour: one daily update per staying pet, and the stay report on check-out day.
  const summaries = await runDailySummaryPass(context.now);
  if (summaries.updates + summaries.reports + summaries.arrivals > 0) {
    context.log(
      `Daily summary job: ${summaries.updates} update(s), ${summaries.reports} stay report(s) and ${summaries.arrivals} arrival note(s) sent`,
    );
  }
};

const runLocked = async (context: BookingJobContext): Promise<void> => {
  await withBookingJobLock(() => runAllPasses(context));
};

/**
 * One run of the job, never two at once in this process: a run still going when the next one is
 * due is not doubled. Failures are logged and the next run tries again.
 */
export const createBookingJobTick = (
  dependencies: BookingJobDependencies,
  runOnce: (context: BookingJobContext) => Promise<void> = runLocked,
): (() => Promise<void>) => {
  let running = false;
  let schemaWarned = false;
  return async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await runOnce({
        ...dependencies,
        store: holdReminderStore,
        cardProcessor: getCardProcessor(),
        now: new Date(),
        log: (message) => console.info(message),
      });
    } catch (error: unknown) {
      if (!isMissingSchema(error)) {
        console.error('Booking job failed', {
          name: error instanceof Error ? error.name : 'unknown',
          message: error instanceof Error ? error.message : String(error),
        });
      } else if (!schemaWarned) {
        schemaWarned = true;
        console.warn(
          'Booking job is waiting for the database migration 20260929_card_guarantee_and_check_in.sql',
        );
      }
    } finally {
      running = false;
    }
  };
};

export interface BookingJobs {
  stop(): void;
}

export const startBookingJobs = (
  environment: Record<string, string | undefined> = process.env,
): BookingJobs | null => {
  if (environment.BOOKING_JOBS?.trim() === 'off') {
    console.info('Booking job is off (BOOKING_JOBS=off)');
    return null;
  }
  const emailSetup = readEmailSetup(environment);
  if ('problem' in emailSetup) {
    console.warn(`Booking reminder emails are off: ${emailSetup.problem}. Cards are still held.`);
  }
  const tick = createBookingJobTick({
    emailSender: 'sender' in emailSetup ? emailSetup.sender : null,
    contact: readTeamContact(environment),
  });
  const first = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS);
  const every = setInterval(() => void tick(), BOOKING_JOB_INTERVAL_MS);
  // The job never keeps the process alive on its own.
  first.unref();
  every.unref();
  return {
    stop: (): void => {
      clearTimeout(first);
      clearInterval(every);
    },
  };
};
