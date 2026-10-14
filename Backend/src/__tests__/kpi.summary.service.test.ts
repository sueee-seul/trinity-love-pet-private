import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findScheduledTaskKpiRecordsBetween,
  type TaskKpiRecord,
} from '../repositories/kpi.repository.js';
import { buildDailyKpiFigures } from '../services/kpi.summary.service.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../repositories/kpi.repository.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findScheduledTaskKpiRecordsBetween: vi.fn(),
}));

const buildRecord = (overrides: Partial<TaskKpiRecord>): TaskKpiRecord => ({
  id: 'task',
  title: 'Custom task',
  status: 'pending',
  scheduled_at: null,
  completed_at: null,
  created_at: '2026-09-20T00:00:00Z',
  category: 'care',
  task_type: 'pet',
  priority: 'mid',
  pet_name: null,
  staff_name: 'Aroha',
  ...overrides,
});

describe('KPI daily summary figures', () => {
  beforeEach(() => {
    vi.mocked(findScheduledTaskKpiRecordsBetween).mockReset();
  });

  it('builds one Auckland day with the 30-minute grace and the previous 7 days', async () => {
    vi.mocked(findScheduledTaskKpiRecordsBetween).mockResolvedValue([
      // 30/09 09:00 (real 29/09 20:00Z), done 20m after → on time
      buildRecord({
        status: 'completed',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T20:20:00Z',
      }),
      // 30/09 10:00 (real 29/09 21:00Z), done 60m after → overdue
      buildRecord({
        status: 'completed',
        scheduled_at: '2026-09-30T10:00:00Z',
        completed_at: '2026-09-29T22:00:00Z',
      }),
      // 30/09 14:00, still pending the next day → overdue, incomplete
      buildRecord({ status: 'pending', scheduled_at: '2026-09-30T14:00:00Z' }),
      // 30/09, time not set → never overdue, incomplete
      buildRecord({ staff_name: 'Ben', status: 'pending', scheduled_at: '2026-09-30T00:00:00Z' }),
      // 30/09 23:00 (real 30/09 10:00Z), done after Auckland midnight → overdue, incomplete
      buildRecord({
        staff_name: 'Ben',
        status: 'completed',
        scheduled_at: '2026-09-30T23:00:00Z',
        completed_at: '2026-09-30T11:30:00Z',
      }),
      // Previous days: 1 of 2 completed → 50%
      buildRecord({
        status: 'completed',
        scheduled_at: '2026-09-29T09:00:00Z',
        completed_at: '2026-09-28T20:10:00Z',
      }),
      buildRecord({ status: 'pending', scheduled_at: '2026-09-29T10:00:00Z' }),
    ]);

    const figures = await buildDailyKpiFigures(
      '2026-09-30',
      new Date('2026-10-01T00:00:00Z'), // Auckland 01/10 13:00
    );

    expect(findScheduledTaskKpiRecordsBetween).toHaveBeenCalledWith('2026-09-30', '2026-10-01');
    expect(figures).toEqual({
      date: '2026-09-30',
      scheduled: 5,
      completed: 3,
      completionRate: 60,
      overdue: 3,
      incompleteAtDayEnd: 3,
      staff: [
        { name: 'Aroha', overdue: 2, assigned: 3 },
        { name: 'Ben', overdue: 1, assigned: 2 },
      ],
    });
  });

  it('returns zero figures when nothing was scheduled', async () => {
    vi.mocked(findScheduledTaskKpiRecordsBetween).mockResolvedValue([]);

    const figures = await buildDailyKpiFigures('2026-09-30', new Date('2026-10-01T00:00:00Z'));

    expect(figures.scheduled).toBe(0);
    expect(figures.staff).toEqual([]);
  });
});
