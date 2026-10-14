import { describe, expect, it, vi } from 'vitest';
import {
  currentPeriodSoFar,
  lastCompletedPeriod,
  previousPeriod,
  formatPeriodLabel,
} from '../services/kpi.report.periods.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const TODAY = '2026-10-01'; // Thursday

describe('KPI report periods', () => {
  it('uses the last full Monday-to-Sunday week', () => {
    expect(lastCompletedPeriod('weekly', TODAY)).toEqual({
      start: '2026-09-21',
      end: '2026-09-28',
    });
  });

  it('uses the last full calendar month', () => {
    expect(lastCompletedPeriod('monthly', TODAY)).toEqual({
      start: '2026-09-01',
      end: '2026-10-01',
    });
  });

  it('covers this week up to today for a manual run', () => {
    expect(currentPeriodSoFar('weekly', TODAY)).toEqual({ start: '2026-09-28', end: '2026-10-02' });
  });

  it('finds the full period before', () => {
    expect(previousPeriod('weekly', { start: '2026-09-21', end: '2026-09-28' })).toEqual({
      start: '2026-09-14',
      end: '2026-09-21',
    });
    expect(previousPeriod('monthly', { start: '2026-09-01', end: '2026-10-01' })).toEqual({
      start: '2026-08-01',
      end: '2026-09-01',
    });
  });

  it('uses the last full calendar quarter', () => {
    expect(lastCompletedPeriod('quarterly', '2026-10-06')).toEqual({
      start: '2026-07-01',
      end: '2026-10-01',
    });
    expect(lastCompletedPeriod('quarterly', '2026-12-31')).toEqual({
      start: '2026-07-01',
      end: '2026-10-01',
    });
    expect(lastCompletedPeriod('quarterly', '2027-01-01')).toEqual({
      start: '2026-10-01',
      end: '2027-01-01',
    });
  });

  it('finds the quarter before and labels a quarter', () => {
    const quarter = { start: '2026-07-01', end: '2026-10-01' };
    expect(previousPeriod('quarterly', quarter)).toEqual({
      start: '2026-04-01',
      end: '2026-07-01',
    });
    expect(formatPeriodLabel('quarterly', quarter)).toBe('Jul to Sep 2026');
  });
});
