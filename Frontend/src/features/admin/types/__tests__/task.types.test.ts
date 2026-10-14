import { describe, expect, it } from 'vitest';
import { formatTaskTime } from '../task.types';

describe('formatTaskTime', () => {
  it('shows the stored wall-clock time in each style', () => {
    expect(formatTaskTime('2026-09-22T09:05:00.000Z')).toBe('9:05 AM');
    expect(formatTaskTime('2026-09-22T13:30:00.000Z', 'date')).toBe('Sep 22, 1:30 PM');
    expect(formatTaskTime('2026-09-22T13:30:00.000Z', 'weekday')).toBe('Tue 1:30 PM');
  });

  it('says the time is not set for a task still at midnight', () => {
    expect(formatTaskTime('2026-09-22T00:00:00.000Z')).toBe('Time not set');
    expect(formatTaskTime('2026-09-22T00:00:00.000Z', 'date')).toBe('Sep 22, time not set');
    expect(formatTaskTime('2026-09-22T00:00:00.000Z', 'weekday')).toBe('Tue, time not set');
  });

  it('says there is no time when the value is missing', () => {
    expect(formatTaskTime(null)).toBe('No time');
  });
});
