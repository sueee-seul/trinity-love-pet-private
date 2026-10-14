import * as repository from '../repositories/staff.dashboard.repository.js';
import type { DashboardRange } from '../repositories/staff.dashboard.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';

export interface StaffOverviewRow {
  id: string;
  name: string;
  email: string;
  employeeNumber: string | null;
  role: string | null;
  onShift: boolean;
  tasksDone: number;
  tasksTotal: number;
  overdue: number;
  issues: number;
}

export interface StaffOverviewResult {
  range: DashboardRange;
  totals: {
    staff: number;
    fullTime: number;
    partTime: number;
    onShiftNow: number;
    overdueTasks: number;
    openIssues: number;
  };
  staff: StaffOverviewRow[];
}

//total
export const getOverview = async (range: DashboardRange): Promise<StaffOverviewResult> => {
  const rollup = (await repository.findStaffRollUp(range)).rows as Array<{
    id: string;
    name: string;
    email: string;
    employee_number: string | null;
    staff_role: string | null;
    employment_type: string | null;
    on_shift: boolean;
    tasks_done: number;
    tasks_total: number;
    overdue: number;
    issues: number;
  }>;
  const overdueTasks = Number((await repository.countOverdueTasks(range)).rows[0]?.count ?? 0);
  const openIssues = Number((await repository.countOpenIssues(range)).rows[0]?.count ?? 0);

  const staff: StaffOverviewRow[] = rollup.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    employeeNumber: r.employee_number,
    role: r.staff_role ?? null,
    onShift: Boolean(r.on_shift),
    tasksDone: Number(r.tasks_done),
    tasksTotal: Number(r.tasks_total),
    overdue: Number(r.overdue),
    issues: Number(r.issues),
  }));

  return {
    range,
    totals: {
      staff: staff.length,
      fullTime: rollup.filter((r) => r.employment_type === 'full-time').length,
      partTime: rollup.filter((r) => r.employment_type === 'part-time').length,
      onShiftNow: staff.filter((s) => s.onShift).length,
      overdueTasks,
      openIssues,
    },
    staff,
  };
};

//Staff detail page

export interface StaffDetailResult {
  range: DashboardRange;
  staff: {
    id: string;
    name: string;
    email: string;
    employeeNumber: string | null;
    role: string | null;
    employmentType: string | null;
    onShift: boolean;
    notes: string | null;
  };

  completion: {
    done: number;
    overdue: number;
    pending: number;
    rate: number; // 0-10
  };
  recentIssues: Array<{
    id: string;
    title: string;
    issue: string;
    flagged: boolean;
    at: string | null;
  }>;
  todaysTasks: Array<{
    id: string;
    title: string;
    location: string | null;
    petName: string | null;
    scheduledAt: string | null;
    status: string;
    overdue: boolean;
    overdueMinutes: number | null;
  }>;
  shiftCalendar: Array<{
    date: string; // YYYY-MM-DD
    start: string | null;
    finish: string | null;
  }>;
}

interface ShiftEntry {
  date?: unknown;
  start?: unknown;
  finish?: unknown;
}

// employees.shift_details parsing
const parseShiftCalendar = (raw: string | null): StaffDetailResult['shiftCalendar'] => {
  if (!raw || !raw.trim().startsWith('[')) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ShiftEntry[])
      .filter((entry) => entry && typeof entry.date === 'string')
      .map((entry) => ({
        date: entry.date as string,
        start: typeof entry.start === 'string' ? entry.start : null,
        finish: typeof entry.finish === 'string' ? entry.finish : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
};

//calculate
export const getStaffDetail = async (
  staffId: string,
  range: DashboardRange,
): Promise<StaffDetailResult> => {
  const profile = (await repository.findStaffProfile(staffId)).rows[0] as
    | {
        id: string;
        name: string;
        email: string;
        employee_number: string | null;
        staff_role: string | null;
        employment_type: string | null;
        notes: string | null;
        shift_details: string | null;
        on_shift: boolean;
      }
    | undefined;

  if (!profile) {
    throw new AppError('Staff member not found', 'STAFF_NOT_FOUND', 404);
  }

  const breakdown = (await repository.findCompletionBreakdown(staffId, range)).rows[0] as
    { done: number; overdue: number; pending: number } | undefined;
  const done = Number(breakdown?.done ?? 0);
  const overdue = Number(breakdown?.overdue ?? 0);
  const pending = Number(breakdown?.pending ?? 0);
  const total = done + overdue + pending;

  const recentIssues = (await repository.findRecentIssues(staffId, 5)).rows.map(
    (r: { id: string; title: string; issue: string; flagged: boolean; at: string | null }) => ({
      id: r.id,
      title: r.title,
      issue: r.issue,
      flagged: Boolean(r.flagged),
      at: r.at ?? null,
    }),
  );

  const todaysTasks = (await repository.findTodaysTasks(staffId)).rows.map(
    (r: {
      id: string;
      title: string;
      location: string | null;
      pet_name: string | null;
      scheduled_at: string | null;
      status: string;
      overdue: boolean;
      overdue_minutes: number | null;
    }) => ({
      id: r.id,
      title: r.title,
      location: r.location ?? null,
      petName: r.pet_name ?? null,
      scheduledAt: r.scheduled_at ?? null,
      status: r.status,
      overdue: Boolean(r.overdue),
      overdueMinutes: r.overdue_minutes === null ? null : Number(r.overdue_minutes),
    }),
  );

  return {
    range,
    staff: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      employeeNumber: profile.employee_number ?? null,
      role: profile.staff_role ?? null,
      employmentType: profile.employment_type ?? null,
      onShift: Boolean(profile.on_shift),
      notes: profile.notes ?? null,
    },

    completion: {
      done,
      overdue,
      pending,
      rate: total === 0 ? 0 : Math.round((done / total) * 100),
    },
    recentIssues,
    todaysTasks,
    shiftCalendar: parseShiftCalendar(profile.shift_details),
  };
};
