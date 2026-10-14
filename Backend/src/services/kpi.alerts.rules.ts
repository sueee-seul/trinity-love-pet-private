import type { TaskKpiRecord } from '../repositories/kpi.repository.js';
import {
  hasScheduledTime,
  OVERDUE_GRACE_MINUTES,
  toKpiCategory,
  toMinuteTime,
  toRealScheduledTime,
} from './kpi.service.js';

export const KPI_ALERT_RULES = [
  'overdue-rate',
  'staff-overdue',
  'critical-overdue',
  'time-not-set',
  'report-ready',
] as const;

export type KpiAlertRule = (typeof KPI_ALERT_RULES)[number];

/** One alert a check would raise. `severity` decides whether a repeat counts as worse. */
export interface KpiAlertCandidate {
  rule: KpiAlertRule;
  /** What the alert is about: 'team', a staff name, or a task id. */
  subject: string;
  severity: number;
  title: string;
  body: string;
}

/**
 * Default thresholds from the KPI Reports and Alerts Plan. The staff workload rule is left to
 * the reassignment agent, since a fair comparison needs each staff member's shift.
 */
export const KPI_ALERT_THRESHOLDS = {
  overdueRatePercent: 30,
  overdueRateMinimum: 3,
  staffOverduePercent: 50,
  staffOverdueMinimum: 2,
  timeNotSetFromHour: 8,
} as const;

const GRACE_MS = OVERDUE_GRACE_MINUTES * 60 * 1000;
const UNASSIGNED = 'Unassigned';

const isOpen = (task: TaskKpiRecord): boolean =>
  task.status === 'pending' || task.status === 'in_progress';

/** Real deadline (scheduled time + grace) in ms, or null when the task has no time set. */
const deadlineOf = (task: TaskKpiRecord): number | null =>
  task.scheduled_at && hasScheduledTime(task.scheduled_at)
    ? toRealScheduledTime(task.scheduled_at).getTime() + GRACE_MS
    : null;

const isOverdueAt = (task: TaskKpiRecord, deadline: number, nowMs: number): boolean =>
  task.status === 'completed'
    ? task.completed_at !== null && toMinuteTime(task.completed_at) > deadline
    : isOpen(task) && toMinuteTime(new Date(nowMs)) > deadline;

const staffOf = (task: TaskKpiRecord): string => task.staff_name ?? UNASSIGNED;

const toPercent = (part: number, whole: number): number => Math.round((part / whole) * 100);

const reachesPercent = (part: number, whole: number, percent: number): boolean =>
  whole > 0 && part * 100 >= percent * whole;

const countBy = <T>(items: T[], keyOf: (item: T) => string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const mostCommonCategory = (tasks: TaskKpiRecord[]): string =>
  [...countBy(tasks, (task) => toKpiCategory(task)).entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? 'Other';

const checkOverdueRate = (pastDueCount: number, overdue: TaskKpiRecord[]): KpiAlertCandidate[] => {
  const { overdueRatePercent, overdueRateMinimum } = KPI_ALERT_THRESHOLDS;
  if (
    overdue.length < overdueRateMinimum ||
    !reachesPercent(overdue.length, pastDueCount, overdueRatePercent)
  ) {
    return [];
  }
  return [
    {
      rule: 'overdue-rate',
      subject: 'team',
      severity: overdue.length,
      title: `Team overdue ${toPercent(overdue.length, pastDueCount)}% (${overdue.length}/${pastDueCount})`,
      body: `${mostCommonCategory(overdue)} tasks delayed most`,
    },
  ];
};

const checkStaffOverdue = (
  pastDue: TaskKpiRecord[],
  overdue: TaskKpiRecord[],
): KpiAlertCandidate[] => {
  const { staffOverduePercent, staffOverdueMinimum } = KPI_ALERT_THRESHOLDS;
  const alerts: KpiAlertCandidate[] = [];
  for (const [name, pastDueCount] of countBy(pastDue, staffOf)) {
    const staffOverdue = overdue.filter((task) => staffOf(task) === name);
    if (
      staffOverdue.length < staffOverdueMinimum ||
      !reachesPercent(staffOverdue.length, pastDueCount, staffOverduePercent)
    ) {
      continue;
    }
    alerts.push({
      rule: 'staff-overdue',
      subject: name,
      severity: staffOverdue.length,
      title: `${name} overdue ${toPercent(staffOverdue.length, pastDueCount)}% (${staffOverdue.length}/${pastDueCount})`,
      body: `${mostCommonCategory(staffOverdue)} tasks delayed`,
    });
  }
  return alerts;
};

/** Booking medication tasks, plus manual ones titled "Medication...", e.g. "Medication: Carprofen". */
const isMedical = (task: TaskKpiRecord): boolean =>
  toKpiCategory(task) === 'Medical' || /^medication/i.test(task.title.trim());

const isCritical = (task: TaskKpiRecord): boolean =>
  task.priority === 'high' || task.priority === 'urgent' || isMedical(task);

const checkCriticalOverdue = (overdue: TaskKpiRecord[]): KpiAlertCandidate[] =>
  overdue.filter(isCritical).map((task) => ({
    rule: 'critical-overdue',
    subject: task.id,
    severity: 1,
    title: `${isMedical(task) ? 'Medical' : 'High priority'} task overdue: ${task.title}`,
    body: [staffOf(task), task.pet_name].filter(Boolean).join(' · '),
  }));

const checkTimeNotSet = (tasks: TaskKpiRecord[], aucklandHour: number): KpiAlertCandidate[] => {
  if (aucklandHour < KPI_ALERT_THRESHOLDS.timeNotSetFromHour) {
    return [];
  }
  const count = tasks.filter(
    (task) => task.scheduled_at !== null && !hasScheduledTime(task.scheduled_at) && isOpen(task),
  ).length;
  if (count === 0) {
    return [];
  }
  return [
    {
      rule: 'time-not-set',
      subject: 'team',
      severity: count,
      title: count === 1 ? '1 task today has no time set' : `${count} tasks today have no time set`,
      body: 'Set a time so overdue can be tracked',
    },
  ];
};

/**
 * Evaluates the four rule alerts for today's tasks (cancelled excluded by the query).
 * A task is past due once its real scheduled time + 30 minutes has passed; tasks with no time set
 * (00:00) are never overdue.
 */
export const evaluateKpiAlertRules = (
  tasks: TaskKpiRecord[],
  now: Date,
  aucklandHour: number,
): KpiAlertCandidate[] => {
  const nowMs = now.getTime();
  const pastDue: TaskKpiRecord[] = [];
  const overdue: TaskKpiRecord[] = [];
  for (const task of tasks) {
    const deadline = deadlineOf(task);
    if (deadline === null || toMinuteTime(now) <= deadline) {
      continue;
    }
    pastDue.push(task);
    if (isOverdueAt(task, deadline, nowMs)) {
      overdue.push(task);
    }
  }

  return [
    ...checkOverdueRate(pastDue.length, overdue),
    ...checkStaffOverdue(pastDue, overdue),
    ...checkCriticalOverdue(overdue),
    ...checkTimeNotSet(tasks, aucklandHour),
  ];
};
