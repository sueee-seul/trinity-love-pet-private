import { afterEach, describe, beforeEach, expect, it, vi } from 'vitest';
import {
  findOverdueRateByPeriod,
  findScheduledTaskKpiRecordsByPeriod,
  findTaskKpiRecordsByPeriod,
  type TaskKpiRecord,
} from '../repositories/kpi.repository.js';
import { getKpiDashboard } from '../services/kpi.service.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../repositories/kpi.repository.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findTaskKpiRecordsByPeriod: vi.fn(),
  findScheduledTaskKpiRecordsByPeriod: vi.fn(),
  findOverdueRateByPeriod: vi.fn(),
}));

const buildRecord = (overrides: Partial<TaskKpiRecord>): TaskKpiRecord => ({
  id: 'task',
  title: 'Custom task',
  status: 'completed',
  scheduled_at: null,
  completed_at: null,
  created_at: '2026-09-29T12:00:00Z',
  category: 'care',
  task_type: 'general',
  priority: 'medium',
  pet_name: null,
  staff_name: null,
  ...overrides,
});

describe('KPI service', () => {
  beforeEach(() => {
    vi.mocked(findTaskKpiRecordsByPeriod).mockResolvedValue([]);
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([]);
    vi.mocked(findOverdueRateByPeriod).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('measures average completion time from the later of creation and real scheduled time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findOverdueRateByPeriod).mockResolvedValue([]);
    vi.mocked(findTaskKpiRecordsByPeriod).mockResolvedValue([
      // Booked in advance for 30/09 09:00 (real 29/09 20:00Z): measured from scheduled → 60m
      buildRecord({
        created_at: '2026-09-28T01:00:00Z',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T21:00:00Z',
      }),
      // Scheduled 30/09 04:00 (real 29/09 15:00Z), before creation: measured from creation → 30m
      buildRecord({
        created_at: '2026-09-29T18:00:00Z',
        scheduled_at: '2026-09-30T04:00:00Z',
        completed_at: '2026-09-29T18:30:00Z',
      }),
      // Scheduled 30/09 11:00 (real 29/09 22:00Z), completed early → 0m
      buildRecord({
        created_at: '2026-09-29T12:00:00Z',
        scheduled_at: '2026-09-30T11:00:00Z',
        completed_at: '2026-09-29T18:00:00Z',
      }),
      // Time not set (00:00 placeholder) → excluded
      buildRecord({
        created_at: '2026-09-29T12:00:00Z',
        scheduled_at: '2026-09-30T00:00:00Z',
        completed_at: '2026-09-29T13:00:00Z',
      }),
      // No scheduled time → excluded
      buildRecord({
        created_at: '2026-09-29T12:00:00Z',
        completed_at: '2026-09-29T13:00:00Z',
      }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.avgCompletionTime).toEqual([{ label: '30/09', value: 30 }]);
  });

  it('groups completion trend by the Auckland scheduled date without re-applying the offset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findOverdueRateByPeriod).mockResolvedValue([]);
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      // Scheduled 30/09 09:00, completed → numerator + denominator
      buildRecord({
        status: 'completed',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T21:00:00Z',
      }),
      // Scheduled 30/09 14:00 (after 11:00, must stay on 30/09) → denominator
      buildRecord({ status: 'pending', scheduled_at: '2026-09-30T14:00:00Z' }),
      // Scheduled 30/09, time not set → denominator
      buildRecord({ status: 'pending', scheduled_at: '2026-09-30T00:00:00Z' }),
      // Scheduled 30/09, cancelled → excluded
      buildRecord({ status: 'cancelled', scheduled_at: '2026-09-30T10:00:00Z' }),
      // Scheduled 01/11 → not counted on 30/09
      buildRecord({ status: 'pending', scheduled_at: '2026-11-01T09:00:00Z' }),
      // No scheduled time → excluded
      buildRecord({ status: 'pending' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.completionTrend).toEqual([{ label: '30/09', value: 33.3 }]);
  });
  it('buckets completion delay past the 30-minute grace after the real scheduled time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findTaskKpiRecordsByPeriod).mockResolvedValue([
      // Scheduled 30/09 09:00 (real 29/09 20:00Z), completed 45m after → 15m past grace → 10-30m
      buildRecord({
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T20:45:00Z',
      }),
      // Scheduled 30/09 10:00 (real 29/09 21:00Z), completed 150m after → 120m past grace → 2-4h
      buildRecord({
        scheduled_at: '2026-09-30T10:00:00Z',
        completed_at: '2026-09-29T23:30:00Z',
      }),
      // Scheduled 30/09 12:00 (real 29/09 23:00Z), completed 20m after → within grace → excluded
      buildRecord({
        scheduled_at: '2026-09-30T12:00:00Z',
        completed_at: '2026-09-29T23:20:00Z',
      }),
      // Completed early → excluded
      buildRecord({
        scheduled_at: '2026-09-30T11:00:00Z',
        completed_at: '2026-09-29T21:00:00Z',
      }),
      // Time not set (00:00 placeholder) → excluded
      buildRecord({
        scheduled_at: '2026-09-30T00:00:00Z',
        completed_at: '2026-09-29T13:00:00Z',
      }),
      // No scheduled time → excluded
      buildRecord({ completed_at: '2026-09-29T13:00:00Z' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.avgDelayTime).toEqual([
      { label: '0-10m', value: 0 },
      { label: '10-30m', value: 1 },
      { label: '30-60m', value: 0 },
      { label: '1-2h', value: 0 },
      { label: '2-4h', value: 1 },
      { label: '4h+', value: 0 },
    ]);
  });

  it('counts scheduled and completed tasks on the same Auckland scheduled date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      // Scheduled 30/09 09:00, completed a day early → bar + line on 30/09
      buildRecord({
        status: 'completed',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-28T20:00:00Z',
      }),
      // Scheduled 30/09 14:00 (after 11:00, must stay on 30/09) → bar
      buildRecord({ status: 'pending', scheduled_at: '2026-09-30T14:00:00Z' }),
      // Scheduled 30/09, time not set → bar
      buildRecord({ status: 'pending', scheduled_at: '2026-09-30T00:00:00Z' }),
      // Cancelled → excluded
      buildRecord({ status: 'cancelled', scheduled_at: '2026-09-30T10:00:00Z' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.scheduledVsCompleted).toEqual([
      { label: '30/09', primary: 3, secondary: 1 },
    ]);
  });
  it('classifies category charts by booking task title', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      buildRecord({ title: 'Feeding (morning)' }),
      buildRecord({ title: 'Feeding (evening)' }),
      buildRecord({ title: 'Grooming' }),
      buildRecord({ title: 'Outdoor Walk' }),
      buildRecord({ title: 'Medication Administration' }),
      buildRecord({ title: 'Extra Playtime' }),
      buildRecord({ title: 'Clean kennels', task_type: 'staff' }),
      buildRecord({ title: 'Grooming', status: 'cancelled' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.categoryDistribution).toEqual([
      { label: 'Feeding', value: 2 },
      { label: 'Grooming', value: 1 },
      { label: 'Walking', value: 1 },
      { label: 'Medical', value: 1 },
      { label: 'Playtime', value: 1 },
      { label: 'Other', value: 1 },
    ]);
    expect(dashboard.series.taskTypeComparison).toEqual([
      { label: 'Feeding', primary: 0, secondary: 2 },
      { label: 'Grooming', primary: 0, secondary: 1 },
      { label: 'Walking', primary: 0, secondary: 1 },
      { label: 'Medical', primary: 0, secondary: 1 },
      { label: 'Playtime', primary: 0, secondary: 1 },
      { label: 'Other', primary: 1, secondary: 0 },
    ]);
  });
  it('classifies routine tasks by their task category', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      buildRecord({ title: 'Dinner', category: 'feeding' }),
      buildRecord({ title: 'Breakfast', category: 'feeding' }),
      buildRecord({ title: 'Potty check: litter tray', category: 'potty' }),
      buildRecord({ title: 'Wellness check', category: 'wellness' }),
      buildRecord({ title: 'Medication: Carprofen', category: 'medication' }),
      buildRecord({ title: 'Morning walk', category: 'exercise' }),
      buildRecord({ title: 'Enrichment play', category: 'enrichment' }),
      buildRecord({ title: 'Grooming: bath and brush', category: 'grooming' }),
      buildRecord({ title: 'Feeding (morning)', category: 'custom' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.categoryDistribution).toEqual([
      { label: 'Feeding', value: 3 },
      { label: 'Potty', value: 1 },
      { label: 'Wellness', value: 1 },
      { label: 'Medical', value: 1 },
      { label: 'Walking', value: 1 },
      { label: 'Playtime', value: 1 },
      { label: 'Grooming', value: 1 },
    ]);
  });

  it('counts tasks per employee from tasks scheduled in the period', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    // Not scheduled in the period → must not be counted
    vi.mocked(findTaskKpiRecordsByPeriod).mockResolvedValue([
      buildRecord({ staff_name: 'Aroha', scheduled_at: '2026-11-01T09:00:00Z' }),
    ]);
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      buildRecord({ staff_name: 'Aroha', scheduled_at: '2026-09-30T09:00:00Z' }),
      buildRecord({ staff_name: 'Aroha', scheduled_at: '2026-09-30T14:00:00Z' }),
      buildRecord({ staff_name: null, scheduled_at: '2026-09-30T10:00:00Z' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.tasksPerEmployee).toEqual([
      { label: 'Aroha', value: 2 },
      { label: 'Unassigned', value: 1 },
    ]);
  });

  it('computes on-time completion rate by priority on the Auckland scheduled date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T00:00:00Z')); // Auckland 30/09 13:00 (NZDT)
    vi.mocked(findScheduledTaskKpiRecordsByPeriod).mockResolvedValue([
      // High, scheduled 30/09 09:00 (real 29/09 20:00Z), done 10m after → on time
      buildRecord({
        priority: 'high',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T20:10:00Z',
      }),
      // High, done exactly 30m after → on time
      buildRecord({
        priority: 'high',
        scheduled_at: '2026-09-30T09:00:00Z',
        completed_at: '2026-09-29T20:30:00Z',
      }),
      // High, scheduled 30/09 10:00 (real 29/09 21:00Z), done 45m after → late
      buildRecord({
        priority: 'high',
        scheduled_at: '2026-09-30T10:00:00Z',
        completed_at: '2026-09-29T21:45:00Z',
      }),
      // High (urgent), scheduled 30/09 14:00 (real 30/09 01:00Z), done early → on time
      buildRecord({
        priority: 'urgent',
        scheduled_at: '2026-09-30T14:00:00Z',
        completed_at: '2026-09-30T00:30:00Z',
      }),
      // Medium, scheduled 30/09 12:00 (real 29/09 23:00Z), done 50m after → late
      buildRecord({
        priority: 'mid',
        scheduled_at: '2026-09-30T12:00:00Z',
        completed_at: '2026-09-29T23:50:00Z',
      }),
      // Time not set (00:00) → excluded
      buildRecord({
        priority: 'high',
        scheduled_at: '2026-09-30T00:00:00Z',
        completed_at: '2026-09-29T13:00:00Z',
      }),
      // Pending → excluded
      buildRecord({ status: 'pending', priority: 'low', scheduled_at: '2026-09-30T10:00:00Z' }),
    ]);

    const dashboard = await getKpiDashboard('today');

    expect(dashboard.series.completionEfficiencyByPriority).toEqual([
      { label: '30/09', high: 75, medium: 0, low: 0 },
    ]);
  });
});
