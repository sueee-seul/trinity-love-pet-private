import { describe, expect, it, vi } from 'vitest';
import {
  compareKeyNumbers,
  findBiggestMovers,
  findTrendWarnings,
} from '../services/kpi.report.compare.js';
import type { KpiReportFigures } from '../services/kpi.report.figures.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const figures = (overrides: Partial<KpiReportFigures>): KpiReportFigures => ({
  scheduled: 100,
  completed: 90,
  completionRate: 90,
  pastDue: 80,
  overdue: 8,
  overdueRate: 10,
  onTimeRate: 85,
  avgCompletionMinutes: 20,
  avgDelayMinutes: 15,
  created: 95,
  categories: { Walking: { scheduled: 30, overdue: 3 }, Feeding: { scheduled: 50, overdue: 2 } },
  priorities: {
    high: { completed: 10, onTime: 9, onTimeRate: 90 },
    medium: { completed: 60, onTime: 51, onTimeRate: 85 },
    low: { completed: 20, onTime: 17, onTimeRate: 85 },
  },
  taskTypes: { pet: 90, staff: 10 },
  staff: [],
  ...overrides,
});

describe('KPI report comparison', () => {
  it('compares key numbers and marks the worse direction', () => {
    const changes = compareKeyNumbers(
      figures({ overdueRate: 18, onTimeRate: 79 }),
      figures({ overdueRate: 11, onTimeRate: 86 }),
    );

    expect(changes.find((change) => change.key === 'overdueRate')).toMatchObject({
      current: 18,
      previous: 11,
      change: 7,
      worse: true,
    });
    expect(changes.find((change) => change.key === 'onTimeRate')).toMatchObject({
      change: -7,
      worse: true,
    });
    expect(changes.find((change) => change.key === 'scheduled')).toMatchObject({ worse: false });
  });

  it('lists the biggest category, priority and volume changes', () => {
    const current = figures({
      categories: {
        Walking: { scheduled: 32, overdue: 15 },
        Feeding: { scheduled: 60, overdue: 2 },
      },
      priorities: {
        high: { completed: 10, onTime: 7, onTimeRate: 72 },
        medium: { completed: 60, onTime: 51, onTimeRate: 85 },
        low: { completed: 20, onTime: 17, onTimeRate: 85 },
      },
    });

    expect(findBiggestMovers(current, figures({}))).toEqual([
      'Walking overdue 3 → 15',
      'High priority on-time 90% → 72%',
      'Feeding tasks 50 → 60',
    ]);
  });

  it('warns when a metric got worse three periods in a row', () => {
    const history = [18, 21, 24, 31].map((minutes) => figures({ avgCompletionMinutes: minutes }));

    expect(findTrendWarnings(history, 'weekly')).toEqual([
      'Average completion time up 3 weeks in a row (18m → 21m → 24m → 31m)',
    ]);
    expect(findTrendWarnings(history.slice(1), 'weekly')).toEqual([]); // not enough periods
  });
});
