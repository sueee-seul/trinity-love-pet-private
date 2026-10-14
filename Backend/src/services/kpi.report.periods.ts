import { addDays } from './kpi.summary.service.js';

export const KPI_REPORT_TYPES = ['weekly', 'monthly', 'quarterly'] as const;
export type KpiReportType = (typeof KPI_REPORT_TYPES)[number];

/** Titles: "Weekly report ready", "Quarterly KPI report". */
export const REPORT_TYPE_LABELS: Record<KpiReportType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

/** Plural units for trend sentences, e.g. "worse 3 quarters in a row". */
export const REPORT_PERIOD_UNITS: Record<KpiReportType, string> = {
  weekly: 'weeks',
  monthly: 'months',
  quarterly: 'quarters',
};

/** Auckland dates [start, end) as YYYY-MM-DD; `end` is the day after the last day. */
export interface ReportPeriod {
  start: string;
  end: string;
}

const DAYS_PER_WEEK = 7;
const MONTHS_PER_QUARTER = 3;

const mondayOffset = (date: string): number => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

const startOfWeek = (date: string): string => addDays(date, -mondayOffset(date));

const startOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

/** Calendar quarters: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. */
const startOfQuarter = (date: string): string => {
  const monthIndex = Number(date.slice(5, 7)) - 1;
  const quarterMonth = monthIndex - (monthIndex % MONTHS_PER_QUARTER) + 1;
  return `${date.slice(0, 4)}-${String(quarterMonth).padStart(2, '0')}-01`;
};

const addMonths = (monthStart: string, months: number): string => {
  const value = new Date(`${monthStart}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
};

/** First day of the week (Monday), month or quarter that contains `date`. */
const startOfPeriod = (type: KpiReportType, date: string): string => {
  if (type === 'weekly') {
    return startOfWeek(date);
  }
  return type === 'monthly' ? startOfMonth(date) : startOfQuarter(date);
};

/** Moves a period start by whole periods (negative goes back). */
const shiftPeriodStart = (type: KpiReportType, start: string, count: number): string => {
  if (type === 'weekly') {
    return addDays(start, DAYS_PER_WEEK * count);
  }
  return addMonths(start, (type === 'monthly' ? 1 : MONTHS_PER_QUARTER) * count);
};

/** The last full week (Monday to Sunday), calendar month or calendar quarter before `today`. */
export const lastCompletedPeriod = (type: KpiReportType, today: string): ReportPeriod => {
  const end = startOfPeriod(type, today);
  return { start: shiftPeriodStart(type, end, -1), end };
};

/** This week, month or quarter up to and including `today` (for manual test runs). */
export const currentPeriodSoFar = (type: KpiReportType, today: string): ReportPeriod => ({
  start: startOfPeriod(type, today),
  end: addDays(today, 1),
});

/** The full period right before `period`. */
export const previousPeriod = (type: KpiReportType, period: ReportPeriod): ReportPeriod => ({
  start: shiftPeriodStart(type, period.start, -1),
  end: period.start,
});

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "21 Sep to 27 Sep" for a week, "September 2026" for a month, "Jul to Sep 2026" for a quarter. */
export const formatPeriodLabel = (type: KpiReportType, period: ReportPeriod): string => {
  const start = new Date(`${period.start}T00:00:00Z`);
  if (type === 'monthly') {
    return `${MONTH_LONG[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  const last = new Date(`${addDays(period.end, -1)}T00:00:00Z`);
  if (type === 'quarterly') {
    return `${MONTH_SHORT[start.getUTCMonth()]} to ${MONTH_SHORT[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  }
  const format = (value: Date): string =>
    `${value.getUTCDate()} ${MONTH_SHORT[value.getUTCMonth()]}`;
  return `${format(start)} to ${format(last)}`;
};
