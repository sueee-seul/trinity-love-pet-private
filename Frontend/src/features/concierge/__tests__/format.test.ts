import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateProblem,
  formatDateList,
  formatDateRange,
  formatNzd,
  gstIncluded,
  nightsBetween,
} from '../utils/format';

const TODAY = '2026-09-28';

describe('concierge formatting', () => {
  it('shows the GST contained in an NZ GST-inclusive price (3/23)', () => {
    expect(gstIncluded(230)).toBe(30);
    expect(gstIncluded(204)).toBe(26.61);
  });

  it('formats New Zealand dollars', () => {
    expect(formatNzd(1234.5)).toBe('$1,234.50');
  });

  it('counts nights like the Backend, with a one-night minimum', () => {
    expect(nightsBetween('2026-10-12', '2026-10-15')).toBe(3);
    expect(nightsBetween('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('shows the weekday with each date, without shifting days across time zones', () => {
    expect(formatDateRange('2026-10-12', '2026-10-15', 'en', TODAY)).toBe(
      'Mon 12 Oct to Thu 15 Oct',
    );
    expect(formatDateRange('2026-10-12', '2026-10-15', 'zh', TODAY)).toContain('10月12日');
    expect(formatDateRange('2026-10-12', '2026-10-15', 'zh', TODAY)).toContain('周一');
  });

  it('adds the year when a date is not in the current year', () => {
    expect(formatDateRange('2026-12-28', '2027-01-03', 'en', TODAY)).toBe(
      'Mon 28 Dec to Sun 3 Jan 2027',
    );
  });

  it('lists full nights in words, in each language', () => {
    expect(formatDateList(['2026-10-13'], 'en', TODAY)).toBe('Tue 13 Oct');
    expect(formatDateList(['2026-10-13', '2026-10-14', '2026-10-15'], 'en', TODAY)).toBe(
      'Tue 13 Oct, Wed 14 Oct and Thu 15 Oct',
    );
    expect(formatDateList(['2026-10-13', '2026-10-14'], 'zh', TODAY)).toBe(
      '10月13日周二、10月14日周三',
    );
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-12', 3)).toBe('2026-10-15');
  });

  it('explains why dates cannot be quoted, like the Backend', () => {
    expect(dateProblem('2026-10-12', '2026-10-15', TODAY)).toBeNull();
    expect(dateProblem('2026-09-20', '2026-09-25', TODAY)).toBe('in_past');
    expect(dateProblem('2026-10-15', '2026-10-12', TODAY)).toBe('end_before_start');
    expect(dateProblem('2026-10-12', '2026-10-12', TODAY)).toBe('end_before_start');
    expect(dateProblem('2026-10-01', '2027-01-15', TODAY)).toBe('too_long');
    expect(dateProblem(null, '2026-10-15', TODAY)).toBeNull();
  });
});
