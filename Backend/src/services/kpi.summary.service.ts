import {
  findScheduledTaskKpiRecordsBetween,
  type TaskKpiRecord,
} from '../repositories/kpi.repository.js';
import {
  hasScheduledTime,
  OVERDUE_GRACE_MINUTES,
  toMinuteTime,
  toRealScheduledTime,
} from './kpi.service.js';

export interface StaffOverdueFigure {
  name: string;
  overdue: number;
  assigned: number;
}

/** Figures for one Auckland day, from tasks scheduled on it (cancelled excluded). */
export interface DailyKpiFigures {
  /** Auckland date the figures cover (YYYY-MM-DD). */
  date: string;
  scheduled: number;
  completed: number;
  /** Percent of scheduled tasks that are completed. */
  completionRate: number;
  /** Finished, or still open, more than 30 minutes after the real scheduled time. */
  overdue: number;
  /** Not completed by the end of the day (Auckland midnight). */
  incompleteAtDayEnd: number;
  /** Per staff member, most overdue first. */
  staff: StaffOverdueFigure[];
}

const GRACE_MS = OVERDUE_GRACE_MINUTES * 60 * 1000;

/** Shifts a YYYY-MM-DD date by whole days. */
export const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Auckland date of a scheduled_at value, read from its wall-clock UTC fields. */
const toScheduledDate = (scheduledAt: string): string =>
  new Date(scheduledAt).toISOString().slice(0, 10);

const toRate = (completed: number, scheduled: number): number =>
  scheduled > 0 ? Number(((completed / scheduled) * 100).toFixed(1)) : 0;

const isOverdue = (record: TaskKpiRecord, now: Date): boolean => {
  if (!record.scheduled_at || !hasScheduledTime(record.scheduled_at)) {
    return false;
  }
  const deadline = toRealScheduledTime(record.scheduled_at).getTime() + GRACE_MS;
  if (record.status === 'completed') {
    return record.completed_at !== null && toMinuteTime(record.completed_at) > deadline;
  }
  return (
    (record.status === 'pending' || record.status === 'in_progress') && toMinuteTime(now) > deadline
  );
};

const isCompletedByDayEnd = (record: TaskKpiRecord, dayEnd: Date): boolean =>
  record.status === 'completed' &&
  (record.completed_at === null || new Date(record.completed_at).getTime() < dayEnd.getTime());

const buildStaffFigures = (records: TaskKpiRecord[], now: Date): StaffOverdueFigure[] => {
  const byStaff = new Map<string, StaffOverdueFigure>();
  for (const record of records) {
    const name = record.staff_name ?? 'Unassigned';
    const entry = byStaff.get(name) ?? { name, overdue: 0, assigned: 0 };
    entry.assigned += 1;
    if (isOverdue(record, now)) {
      entry.overdue += 1;
    }
    byStaff.set(name, entry);
  }
  return [...byStaff.values()].sort((a, b) => b.overdue - a.overdue || b.assigned - a.assigned);
};

/**
 * Builds the daily summary figures for one Auckland day with the KPI dashboard rules:
 * tasks belong to their scheduled date, overdue starts 30 minutes after the real scheduled time,
 * and tasks with no time set (00:00) are never overdue.
 */
export const buildDailyKpiFigures = async (
  date: string,
  now: Date = new Date(),
): Promise<DailyKpiFigures> => {
  const records = await findScheduledTaskKpiRecordsBetween(date, addDays(date, 1));
  const dayRecords = records.filter(
    (record) => record.scheduled_at !== null && toScheduledDate(record.scheduled_at) === date,
  );
  // Midnight at the end of `date` as a wall-clock value, converted like scheduled_at.
  const dayEnd = toRealScheduledTime(`${addDays(date, 1)}T00:00:00Z`);

  const completed = dayRecords.filter((record) => record.status === 'completed').length;

  return {
    date,
    scheduled: dayRecords.length,
    completed,
    completionRate: toRate(completed, dayRecords.length),
    overdue: dayRecords.filter((record) => isOverdue(record, now)).length,
    incompleteAtDayEnd: dayRecords.filter((record) => !isCompletedByDayEnd(record, dayEnd)).length,
    staff: buildStaffFigures(dayRecords, now),
  };
};
