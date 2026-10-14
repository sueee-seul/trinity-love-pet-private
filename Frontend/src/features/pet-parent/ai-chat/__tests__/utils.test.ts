import { describe, expect, it } from 'vitest';
import { formatDayLabel, formatTime, isoAt } from '../utils';

describe('formatTime', () => {
  it('renders an ISO timestamp as h:mm AM/PM', () => {
    const iso = isoAt(9, 5);
    expect(formatTime(iso)).toBe('9:05 AM');
  });

  it('renders an afternoon time with PM', () => {
    const iso = isoAt(14, 30);
    expect(formatTime(iso)).toBe('2:30 PM');
  });
});

describe('formatDayLabel', () => {
  it('returns "Today" for a timestamp on today\'s date', () => {
    const iso = isoAt(10, 0);
    expect(formatDayLabel(iso)).toBe('Today');
  });

  it('returns a short date label for an earlier date', () => {
    const iso = isoAt(10, 0, 3);
    const expected = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(formatDayLabel(iso)).toBe(expected);
    expect(formatDayLabel(iso)).not.toBe('Today');
  });
});

describe('isoAt', () => {
  it('sets the local hour and minute on the returned timestamp', () => {
    const iso = isoAt(13, 45);
    const date = new Date(iso);
    expect(date.getHours()).toBe(13);
    expect(date.getMinutes()).toBe(45);
  });

  it('offsets the date backward by daysAgo', () => {
    const today = isoAt(10, 0, 0);
    const threeDaysAgo = isoAt(10, 0, 3);
    const diffDays = Math.round(
      (new Date(today).setHours(0, 0, 0, 0) - new Date(threeDaysAgo).setHours(0, 0, 0, 0)) /
        (24 * 60 * 60 * 1000),
    );
    expect(diffDays).toBe(3);
  });

  it('defaults daysAgo to 0 (today)', () => {
    const iso = isoAt(10, 0);
    expect(new Date(iso).toDateString()).toBe(new Date().toDateString());
  });
});
