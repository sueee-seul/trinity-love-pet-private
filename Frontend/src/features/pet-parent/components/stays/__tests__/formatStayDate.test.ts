import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDateTime } from '../formatStayDate';

const at = (year: number, month: number, day: number, hour = 9, minute = 0): string =>
  new Date(year, month - 1, day, hour, minute).toISOString();

describe('formatDateRange', () => {
  it('writes the month and year once when both ends share them', () => {
    expect(formatDateRange(at(2026, 9, 12), at(2026, 9, 16))).toBe('12 to 16 Sep 2026');
    expect(formatDateRange(at(2026, 9, 28), at(2026, 10, 2))).toBe('28 Sep to 2 Oct 2026');
    expect(formatDateRange(at(2026, 12, 28), at(2027, 1, 2))).toBe('28 Dec 2026 to 2 Jan 2027');
  });
});

describe('formatDateTime', () => {
  it('writes the day before the month, as New Zealand does', () => {
    expect(formatDateTime(at(2026, 9, 12, 14, 0))).toBe('12 Sep 2026, 2:00 pm');
  });
});

describe('stay dates in Chinese', () => {
  const afternoon = (year: number, month: number, day: number): string =>
    new Date(year, month, day, 14).toISOString();

  it('writes the year and month once, as Chinese dates do', () => {
    expect(formatDateRange(afternoon(2026, 8, 12), afternoon(2026, 8, 16), 'zh')).toBe(
      '2026年9月12日至16日',
    );
    expect(formatDateRange(afternoon(2026, 8, 28), afternoon(2026, 9, 2), 'zh')).toBe(
      '2026年9月28日至10月2日',
    );
    expect(formatDateRange(afternoon(2026, 11, 28), afternoon(2027, 0, 2), 'zh')).toBe(
      '2026年12月28日至2027年1月2日',
    );
  });

  it('writes a date and time in Chinese', () => {
    expect(formatDateTime(afternoon(2026, 8, 12), 'zh')).toBe('2026年9月12日 下午2:00');
  });
});
