import type { ReportTaskRow } from '../repositories/kpi.report.repository.js';
import {
  hasScheduledTime,
  OVERDUE_GRACE_MINUTES,
  toKpiCategory,
  toMinuteTime,
  toRealScheduledTime,
} from './kpi.service.js';

export const REPORT_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export interface CategoryFigure {
  scheduled: number;
  overdue: number;
}

export interface PriorityFigure {
  completed: number;
  onTime: number;
  onTimeRate: number | null;
}

export interface StaffReportFigure {
  name: string;
  scheduled: number;
  completed: number;
  completionRate: number | null;
  overdue: number;
}

/** One period's figures, with the KPI dashboard's overdue rules. Rates are percentages. */
export interface KpiReportFigures {
  scheduled: number;
  completed: number;
  completionRate: number | null;
  /** Tasks with a time set whose deadline (scheduled + 30 minutes) has passed. */
  pastDue: number;
  overdue: number;
  overdueRate: number | null;
  /** Completed at or before the deadline, among completed tasks with a time set. */
  onTimeRate: number | null;
  /** From max(created, real scheduled time) to completion; early completion counts as 0. */
  avgCompletionMinutes: number | null;
  /** Minutes past the deadline, among late completions. */
  avgDelayMinutes: number | null;
  created: number;
  categories: Record<string, CategoryFigure>;
  priorities: Record<ReportPriority, PriorityFigure>;
  taskTypes: Record<string, number>;
  /** Most overdue first. */
  staff: StaffReportFigure[];
}

const GRACE_MS = OVERDUE_GRACE_MINUTES * 60_000;
const UNASSIGNED = 'Unassigned';

const toRate = (part: number, whole: number): number | null =>
  whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : null;

const average = (values: number[]): number | null =>
  values.length > 0
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;

const toPriority = (priority: string): ReportPriority | null => {
  if (priority === 'high' || priority === 'urgent') {
    return 'high';
  }
  if (priority === 'mid') {
    return 'medium';
  }
  return priority === 'low' ? 'low' : null;
};

interface TaskOutcome {
  /** Real scheduled time in ms, or null when no time is set. */
  scheduledAt: number | null;
  deadline: number | null;
  /** Completion time to the minute, or null when not completed. */
  completedAt: number | null;
  pastDue: boolean;
  overdue: boolean;
}

const outcomeOf = (task: ReportTaskRow, nowMinute: number): TaskOutcome => {
  const scheduledAt =
    task.scheduled_at && hasScheduledTime(task.scheduled_at)
      ? toRealScheduledTime(task.scheduled_at).getTime()
      : null;
  const deadline = scheduledAt === null ? null : scheduledAt + GRACE_MS;
  const completedAt =
    task.status === 'completed' && task.completed_at ? toMinuteTime(task.completed_at) : null;
  const pastDue = deadline !== null && nowMinute > deadline;
  const isOpen = task.status === 'pending' || task.status === 'in_progress';
  const overdue =
    deadline !== null && (completedAt !== null ? completedAt > deadline : isOpen && pastDue);
  return { scheduledAt, deadline, completedAt, pastDue, overdue };
};

const toPriorityFigure = ({
  completed,
  onTime,
}: {
  completed: number;
  onTime: number;
}): PriorityFigure => ({ completed, onTime, onTimeRate: toRate(onTime, completed) });

/** Builds one period's figures from its tasks. `now` decides whether open tasks are overdue. */
export const buildReportFigures = (
  tasks: ReportTaskRow[],
  created: number,
  now: Date,
): KpiReportFigures => {
  const nowMinute = toMinuteTime(now);
  let completed = 0;
  let pastDue = 0;
  let overdue = 0;
  let timedCompleted = 0;
  let onTime = 0;
  const completionMinutes: number[] = [];
  const delayMinutes: number[] = [];
  const categories: Record<string, CategoryFigure> = {};
  const priorities: Record<ReportPriority, { completed: number; onTime: number }> = {
    high: { completed: 0, onTime: 0 },
    medium: { completed: 0, onTime: 0 },
    low: { completed: 0, onTime: 0 },
  };
  const taskTypes: Record<string, number> = {};
  const staff = new Map<string, Omit<StaffReportFigure, 'name' | 'completionRate'>>();

  for (const task of tasks) {
    const outcome = outcomeOf(task, nowMinute);
    const category = (categories[toKpiCategory(task)] ??= { scheduled: 0, overdue: 0 });
    const staffName = task.staff_name ?? UNASSIGNED;
    const person = staff.get(staffName) ?? { scheduled: 0, completed: 0, overdue: 0 };
    staff.set(staffName, person);

    category.scheduled += 1;
    person.scheduled += 1;
    taskTypes[task.task_type] = (taskTypes[task.task_type] ?? 0) + 1;

    if (task.status === 'completed') {
      completed += 1;
      person.completed += 1;
    }
    if (outcome.pastDue) {
      pastDue += 1;
    }
    if (outcome.overdue) {
      overdue += 1;
      category.overdue += 1;
      person.overdue += 1;
    }

    const { scheduledAt, deadline, completedAt } = outcome;
    if (scheduledAt === null || deadline === null || completedAt === null) {
      continue;
    }
    timedCompleted += 1;
    const late = completedAt > deadline;
    const priority = toPriority(task.priority);
    if (late) {
      delayMinutes.push((completedAt - deadline) / 60_000);
    } else {
      onTime += 1;
    }
    if (priority) {
      priorities[priority].completed += 1;
      if (!late) {
        priorities[priority].onTime += 1;
      }
    }
    const startedAt = Math.max(new Date(task.created_at).getTime(), scheduledAt);
    completionMinutes.push(Math.max(0, (completedAt - startedAt) / 60_000));
  }

  return {
    scheduled: tasks.length,
    completed,
    completionRate: toRate(completed, tasks.length),
    pastDue,
    overdue,
    overdueRate: toRate(overdue, pastDue),
    onTimeRate: toRate(onTime, timedCompleted),
    avgCompletionMinutes: average(completionMinutes),
    avgDelayMinutes: average(delayMinutes),
    created,
    categories,
    priorities: {
      high: toPriorityFigure(priorities.high),
      medium: toPriorityFigure(priorities.medium),
      low: toPriorityFigure(priorities.low),
    },
    taskTypes,
    staff: [...staff.entries()]
      .map(([name, figure]) => ({
        name,
        ...figure,
        completionRate: toRate(figure.completed, figure.scheduled),
      }))
      .sort((a, b) => b.overdue - a.overdue || b.scheduled - a.scheduled),
  };
};
