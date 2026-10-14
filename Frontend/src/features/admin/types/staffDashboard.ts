export const DASHBOARD_RANGES = ['today', 'week', 'month'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

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

export interface StaffOverviewTotals {
  staff: number;
  fullTime: number;
  partTime: number;
  onShiftNow: number;
  overdueTasks: number;
  openIssues: number;
}

export interface StaffOverviewResult {
  range: DashboardRange;
  totals: StaffOverviewTotals;
  staff: StaffOverviewRow[];
}

//detailed staff page
export interface StaffDetailStaff {
  id: string;
  name: string;
  email: string;
  employeeNumber: string | null;
  role: string | null;
  employmentType: string | null;
  onShift: boolean;
  notes: string | null;
}

export interface StaffDetailCompletion {
  done: number;
  overdue: number;
  pending: number;
  rate: number;
}

export interface StaffDetailIssue {
  id: string;
  title: string;
  issue: string;
  flagged: boolean;
  at: string | null;
}

export interface StaffDetailTask {
  id: string;
  title: string;
  location: string | null;
  petName: string | null;
  scheduledAt: string | null;
  status: string;
  overdue: boolean;
  overdueMinutes: number | null;
}

export interface StaffDetailShift {
  date: string; // YYYY-MM-DD
  start: string | null;
  finish: string | null;
}

export interface StaffDetailResult {
  range: DashboardRange;
  staff: StaffDetailStaff;
  completion: StaffDetailCompletion;
  recentIssues: StaffDetailIssue[];
  todaysTasks: StaffDetailTask[];
  shiftCalendar: StaffDetailShift[];
}
