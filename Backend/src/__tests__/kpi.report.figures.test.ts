import { describe, expect, it, vi } from 'vitest';
import type { ReportTaskRow } from '../repositories/kpi.report.repository.js';
import { buildReportFigures } from '../services/kpi.report.figures.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const NOW = new Date('2026-10-01T02:00:00Z'); // Auckland 01/10 15:00

const task = (overrides: Partial<ReportTaskRow>): ReportTaskRow => ({
  id: 'task',
  title: 'Outdoor Walk',
  status: 'completed',
  priority: 'mid',
  task_type: 'pet',
  scheduled_at: '2026-09-29T09:00:00Z', // wall-clock 09:00 = real 28/09 20:00Z
  completed_at: null,
  created_at: '2026-09-20T00:00:00Z',
  pet_name: 'Bella',
  staff_name: 'aria.singh',
  issue: null,
  category: 'custom',
  ...overrides,
});

describe('KPI report figures', () => {
  it('counts overdue, on-time, completion time and delay with the 30-minute grace', () => {
    const figures = buildReportFigures(
      [
        task({ id: 'on-time', completed_at: '2026-09-28T20:20:00Z' }), // 20m after → on time
        task({ id: 'edge', completed_at: '2026-09-28T20:30:40Z' }), // 09:30:40 → on time
        task({ id: 'late', priority: 'high', completed_at: '2026-09-28T21:10:00Z' }), // 40m late
        task({ id: 'open', status: 'pending', staff_name: 'sione.tupou' }), // overdue
        task({ id: 'no-time', status: 'pending', scheduled_at: '2026-09-29T00:00:00Z' }),
      ],
      12,
      NOW,
    );

    expect(figures).toMatchObject({
      scheduled: 5,
      completed: 3,
      completionRate: 60,
      pastDue: 4,
      overdue: 2,
      overdueRate: 50,
      onTimeRate: 66.7,
      avgCompletionMinutes: 40, // (20 + 30 + 70) / 3
      avgDelayMinutes: 40,
      created: 12,
      categories: { Walking: { scheduled: 5, overdue: 2 } },
    });
    expect(figures.priorities.high).toEqual({ completed: 1, onTime: 0, onTimeRate: 0 });
    expect(figures.staff[0]).toEqual({
      name: 'aria.singh',
      scheduled: 4,
      completed: 3,
      completionRate: 75,
      overdue: 1,
    });
  });
});
