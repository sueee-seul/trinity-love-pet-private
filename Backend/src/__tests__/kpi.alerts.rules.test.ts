import { describe, expect, it, vi } from 'vitest';
import type { TaskKpiRecord } from '../repositories/kpi.repository.js';
import { evaluateKpiAlertRules, type KpiAlertRule } from '../services/kpi.alerts.rules.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const NOW = new Date('2026-10-01T02:00:00Z'); // Auckland 01/10 15:00 (NZDT)

const task = (overrides: Partial<TaskKpiRecord>): TaskKpiRecord => ({
  id: 'task',
  title: 'Outdoor Walk',
  status: 'pending',
  scheduled_at: '2026-10-01T09:00:00Z', // wall-clock 09:00 = real 30/09 20:00Z
  completed_at: null,
  created_at: '2026-09-20T00:00:00Z',
  category: 'custom',
  task_type: 'pet',
  priority: 'mid',
  pet_name: 'Bella',
  staff_name: 'aria.singh',
  ...overrides,
});

const TODAY_TASKS: TaskKpiRecord[] = [
  task({ id: 'a1' }), // 09:00 open → overdue
  task({ id: 'a2', scheduled_at: '2026-10-01T10:00:00Z' }), // open → overdue
  task({
    id: 'a3',
    status: 'completed',
    scheduled_at: '2026-10-01T11:00:00Z',
    completed_at: '2026-09-30T22:10:00Z', // 10m after → on time
  }),
  task({ id: 'a4', priority: 'high', scheduled_at: '2026-10-01T12:00:00Z' }), // high → overdue
  task({ id: 'a5', title: 'Feeding (morning)', scheduled_at: '2026-10-01T13:00:00Z' }), // overdue
  task({ id: 'a6', scheduled_at: '2026-10-01T16:00:00Z' }), // not due yet
  task({
    id: 'b1',
    staff_name: 'ben',
    status: 'completed',
    completed_at: '2026-09-30T20:05:00Z', // on time
  }),
  task({
    id: 'b2',
    staff_name: 'ben',
    title: 'Medication Administration',
    scheduled_at: '2026-10-01T14:00:00Z', // real 01:00Z, deadline 01:30Z → overdue
  }),
  task({ id: 'b3', staff_name: 'ben', scheduled_at: '2026-10-01T00:00:00Z' }), // time not set
];

const ofRule = (
  rule: KpiAlertRule,
  tasks: TaskKpiRecord[] = TODAY_TASKS,
  hour = 15,
): ReturnType<typeof evaluateKpiAlertRules> =>
  evaluateKpiAlertRules(tasks, NOW, hour).filter((alert) => alert.rule === rule);

describe('KPI rule alerts', () => {
  it('raises the team overdue rate at 30% with at least 3 overdue', () => {
    expect(ofRule('overdue-rate')).toEqual([
      {
        rule: 'overdue-rate',
        subject: 'team',
        severity: 5,
        title: 'Team overdue 71% (5/7)',
        body: 'Walking tasks delayed most',
      },
    ]);
  });

  it('raises staff overdue at 50% with at least 2 overdue', () => {
    expect(ofRule('staff-overdue')).toEqual([
      {
        rule: 'staff-overdue',
        subject: 'aria.singh',
        severity: 4,
        title: 'aria.singh overdue 80% (4/5)',
        body: 'Walking tasks delayed',
      },
    ]);
  });

  it('raises high priority and Medical tasks once they are overdue', () => {
    expect(ofRule('critical-overdue')).toEqual([
      expect.objectContaining({
        subject: 'a4',
        title: 'High priority task overdue: Outdoor Walk',
        body: 'aria.singh · Bella',
      }),
      expect.objectContaining({
        subject: 'b2',
        title: 'Medical task overdue: Medication Administration',
        body: 'ben · Bella',
      }),
    ]);
  });

  it('flags tasks with no time set only from 08:00', () => {
    expect(ofRule('time-not-set', TODAY_TASKS, 7)).toEqual([]);
    expect(ofRule('time-not-set', TODAY_TASKS, 8)).toEqual([
      expect.objectContaining({ severity: 1, title: '1 task today has no time set' }),
    ]);
  });

  it('does not alert below the minimum counts', () => {
    const tasks = [task({ id: 'x1' }), task({ id: 'x2', staff_name: 'ben' })]; // 2/2, 1/1 each

    expect(ofRule('overdue-rate', tasks)).toEqual([]);
    expect(ofRule('staff-overdue', tasks)).toEqual([]);
  });

  it('treats manual tasks titled "Medication..." as Medical even at normal priority', () => {
    const tasks = [task({ id: 'm1', title: 'Medication: Carprofen', priority: 'mid' })];

    expect(ofRule('critical-overdue', tasks)).toEqual([
      expect.objectContaining({
        subject: 'm1',
        title: 'Medical task overdue: Medication: Carprofen',
      }),
    ]);
  });

  it('does not raise a normal-priority task that is not Medical', () => {
    const tasks = [task({ id: 'w1', title: 'Outdoor Walk', priority: 'mid' })];

    expect(ofRule('critical-overdue', tasks)).toEqual([]);
  });

  it('judges overdue to the minute: 09:30:40 is on time, 09:31 is overdue', () => {
    // High priority, scheduled 09:00 (real 30/09 20:00Z), deadline 20:30Z
    const onTime = task({
      id: 'h1',
      priority: 'high',
      status: 'completed',
      completed_at: '2026-09-30T20:30:40Z',
    });
    const late = task({
      id: 'h2',
      priority: 'high',
      status: 'completed',
      completed_at: '2026-09-30T20:31:00Z',
    });

    expect(ofRule('critical-overdue', [onTime, late]).map((alert) => alert.subject)).toEqual([
      'h2',
    ]);
  });
});
