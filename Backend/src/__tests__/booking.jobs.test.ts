import { afterEach, describe, expect, it, vi } from 'vitest';
import { withBookingJobLock } from '../repositories/booking.hold-reminder.repository.js';
import {
  BOOKING_JOB_INTERVAL_MS,
  createBookingJobTick,
  startBookingJobs,
  type BookingJobDependencies,
} from '../services/booking.jobs.js';
import type { BookingJobContext } from '../services/booking.hold-reminder.js';

vi.mock('../repositories/booking.hold-reminder.repository.js', () => ({
  holdReminderStore: {},
  withBookingJobLock: vi.fn(async () => true),
}));

const dependencies: BookingJobDependencies = {
  emailSender: null,
  contact: { email: null, phone: null },
};

const missingColumn = (): Error =>
  Object.assign(new Error('column "reminder_sent_at" does not exist'), { code: '42703' });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(withBookingJobLock).mockClear();
});

describe('the booking job schedule', () => {
  it('does not start when BOOKING_JOBS=off', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    expect(startBookingJobs({ BOOKING_JOBS: 'off' })).toBeNull();
  });

  it('runs a minute after start and then every 15 minutes, until stopped', async () => {
    vi.useFakeTimers();
    const jobs = startBookingJobs({ CONCIERGE_EMAIL_MODE: 'console', NODE_ENV: 'development' });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(withBookingJobLock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(BOOKING_JOB_INTERVAL_MS);
    expect(withBookingJobLock).toHaveBeenCalledTimes(2);

    jobs?.stop();
    await vi.advanceTimersByTimeAsync(BOOKING_JOB_INTERVAL_MS * 2);
    expect(withBookingJobLock).toHaveBeenCalledTimes(2);
  });

  it('says once that it waits for the migration, and logs any other failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runOnce = vi
      .fn<(context: BookingJobContext) => Promise<void>>()
      .mockRejectedValueOnce(missingColumn())
      .mockRejectedValueOnce(missingColumn())
      .mockRejectedValueOnce(new Error('connection refused'));
    const tick = createBookingJobTick(dependencies, runOnce);

    await tick();
    await tick();
    await tick();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('20260929_card_guarantee_and_check_in.sql');
    expect(error).toHaveBeenCalledWith('Booking job failed', {
      name: 'Error',
      message: 'connection refused',
    });
  });

  it('never starts a second run while one is still going', async () => {
    let finish: () => void = () => undefined;
    const runOnce = vi.fn<(context: BookingJobContext) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const tick = createBookingJobTick(dependencies, runOnce);

    const first = tick();
    await tick();
    expect(runOnce).toHaveBeenCalledTimes(1);

    finish();
    await first;
    const next = tick();
    finish();
    await next;
    expect(runOnce).toHaveBeenCalledTimes(2);
  });
});
