import { API_BASE_URL } from '../../../shared/api';
import type {
  DashboardRange,
  StaffOverviewResult,
  StaffOverviewRow,
  StaffOverviewTotals,
  StaffDetailResult,
  StaffDetailStaff,
  StaffDetailCompletion,
  StaffDetailIssue,
  StaffDetailTask,
  StaffDetailShift,
} from '../types/staffDashboard';

const BASE_URL = `${API_BASE_URL}/admin/staff-dashboard`;

export class StaffDashboardApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StaffDashboardApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isOverviewRow = (value: unknown): value is StaffOverviewRow =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.email === 'string' &&
  (value.employeeNumber === null || typeof value.employeeNumber === 'string') &&
  (value.role === null || typeof value.role === 'string') &&
  typeof value.onShift === 'boolean' &&
  isFiniteNumber(value.tasksDone) &&
  isFiniteNumber(value.tasksTotal) &&
  isFiniteNumber(value.overdue) &&
  isFiniteNumber(value.issues);

const isTotals = (value: unknown): value is StaffOverviewTotals =>
  isRecord(value) &&
  isFiniteNumber(value.staff) &&
  isFiniteNumber(value.fullTime) &&
  isFiniteNumber(value.partTime) &&
  isFiniteNumber(value.onShiftNow) &&
  isFiniteNumber(value.overdueTasks) &&
  isFiniteNumber(value.openIssues);

const isOverviewResult = (value: unknown): value is StaffOverviewResult =>
  isRecord(value) &&
  typeof value.range === 'string' &&
  isTotals(value.totals) &&
  Array.isArray(value.staff) &&
  value.staff.every(isOverviewRow);

const errorMessageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Body was empty or not JSON; the fallback is the best available message.
  }
  return fallback;
};

export const fetchStaffOverview = async (range: DashboardRange): Promise<StaffOverviewResult> => {
  const response = await fetch(`${BASE_URL}?range=${encodeURIComponent(range)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new StaffDashboardApiError(
      await errorMessageFrom(response, 'Staff dashboard request failed'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isOverviewResult(payload)) {
    throw new Error('Invalid staff dashboard response');
  }
  return payload;
};

//Staff Detail
const isDetailStaff = (value: unknown): value is StaffDetailStaff =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.email === 'string' &&
  (value.employeeNumber === null || typeof value.employeeNumber === 'string') &&
  (value.role === null || typeof value.role === 'string') &&
  (value.employmentType === null || typeof value.employmentType === 'string') &&
  typeof value.onShift === 'boolean' &&
  (value.notes === null || typeof value.notes === 'string');

const isCompletion = (value: unknown): value is StaffDetailCompletion =>
  isRecord(value) &&
  isFiniteNumber(value.done) &&
  isFiniteNumber(value.overdue) &&
  isFiniteNumber(value.pending) &&
  isFiniteNumber(value.rate);

const isIssue = (value: unknown): value is StaffDetailIssue =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.issue === 'string' &&
  typeof value.flagged === 'boolean' &&
  (value.at === null || typeof value.at === 'string');

const isTask = (value: unknown): value is StaffDetailTask =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  (value.location === null || typeof value.location === 'string') &&
  (value.petName === null || typeof value.petName === 'string') &&
  (value.scheduledAt === null || typeof value.scheduledAt === 'string') &&
  typeof value.status === 'string' &&
  typeof value.overdue === 'boolean' &&
  (value.overdueMinutes === null || isFiniteNumber(value.overdueMinutes));

const isShift = (value: unknown): value is StaffDetailShift =>
  isRecord(value) &&
  typeof value.date === 'string' &&
  (value.start === null || typeof value.start === 'string') &&
  (value.finish === null || typeof value.finish === 'string');

const isDetailResult = (value: unknown): value is StaffDetailResult =>
  isRecord(value) &&
  typeof value.range === 'string' &&
  isDetailStaff(value.staff) &&
  isCompletion(value.completion) &&
  Array.isArray(value.recentIssues) &&
  value.recentIssues.every(isIssue) &&
  Array.isArray(value.todaysTasks) &&
  value.todaysTasks.every(isTask) &&
  Array.isArray(value.shiftCalendar) &&
  value.shiftCalendar.every(isShift);

export const fetchStaffDetail = async (
  staffId: string,
  range: DashboardRange,
): Promise<StaffDetailResult> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(staffId)}?range=${encodeURIComponent(range)}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    throw new StaffDashboardApiError(
      await errorMessageFrom(response, 'Staff detail request filed'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isDetailResult(payload)) {
    throw new Error('Invalid staff detail response');
  }
  return payload;
};
