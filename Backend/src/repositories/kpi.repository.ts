import { pool } from '../config/database.js';
import type { KpiRange } from '../contracts/kpi.contract.js';

/** KPI chart metadata returned to the frontend for rendering. */
export interface KpiChart {
  id: string;
  title: string;
}

/**
 * The full dashboard response returned by the KPI API.
 *
 * `series` contains 15 data arrays:
 * - Legacy (3): completedRate, overdueComposition, avgCompletionTime
 * - Real DB (12): overdueRate (SQL), and 11 computed from task records
 */
export interface KpiDashboardData {
  period: 'today' | 'week' | 'month';
  charts: KpiChart[];
  series: {
    completedRate: Array<{ label: string; value: number | null }>;
    overdueComposition: Array<{
      label: string;
      completedOnTime: number;
      ongoing: number;
      overdue: number;
    }>;
    avgCompletionTime: KpiSeriesPoint[];
    overdueRate: KpiOverduePoint[];
    completionTrend: KpiSeriesPoint[];
    categoryDistribution: KpiCategoryPoint[];
    priorityBreakdown: KpiCategoryPoint[];
    tasksPerEmployee: KpiEmployeePoint[];
    statusOverview: KpiCategoryPoint[];
    scheduledVsCompleted: KpiDualSeriesPoint[];
    avgDelayTime: KpiSeriesPoint[];
    tasksByPet: KpiPetPoint[];
    taskTypeComparison: KpiDualSeriesPoint[];
    creationTrend: KpiSeriesPoint[];
    completionEfficiencyByPriority: KpiTripleSeriesPoint[];
  };
}

/** Bar = overdue count per day; line = on-time completion rate (%) per day. */
export interface KpiOverduePoint {
  label: string;
  primary: number;
  secondary: number;
}

/** Single value data point: a label (e.g. day) and a numeric value. */
export interface KpiSeriesPoint {
  label: string;
  value: number;
}

/** Bar+line data point (e.g. scheduled count vs completed count). */
export interface KpiDualSeriesPoint {
  label: string;
  primary: number;
  secondary: number;
}

/** Grouped bar data point (e.g. high/medium/low priority counts). */
export interface KpiTripleSeriesPoint {
  label: string;
  high: number;
  medium: number;
  low: number;
}

export type KpiCategoryPoint = KpiSeriesPoint;
export type KpiEmployeePoint = KpiSeriesPoint;
export type KpiPetPoint = KpiSeriesPoint;

/** A flattened task record with category, type, priority, pet and staff info. */
export interface TaskKpiRecord {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  category: string;
  task_type: string;
  priority: string;
  pet_name: string | null;
  staff_name: string | null;
}

export interface KpiDayMetric {
  date: string;
  completedRate: number | null;
  overdueRate: number | null;
  avgCompletionMinutes: number | null;
}

export type KpiPeriod = 'today' | 'week' | 'month';

/** Columns selected for KPI task records, including joins to pets and users. */
const TASK_KPI_FIELDS = `
  t.uuid::text AS id,
  t.title,
  t.status,
  t.scheduled_at,
  t.completed_at,
  t.created_at,
  t.category,
  t.task_type,
  t.priority,
  p.name AS pet_name,
  u.username AS staff_name
`;

/** FROM clause for KPI queries: joins pets (for name) and users (for staff name). */
const TASK_KPI_FROM = `
  FROM tasks t
  LEFT JOIN pets p ON p.uuid = t.pet_uuid
  LEFT JOIN users u ON u.uuid = t.employees_uuid
`;

/*
 * scheduled_at stores Auckland wall-clock time in the UTC slot (09:00 Auckland → 09:00+00).
 * Never apply AT TIME ZONE 'Pacific/Auckland' to it directly (adds the offset again).
 */

/** Auckland wall-clock timestamp of scheduled_at, for Auckland dates and day grouping. */
const SCHEDULED_AKL = "(t.scheduled_at AT TIME ZONE 'UTC')";

/** Real UTC instant of scheduled_at, for comparisons with completed_at and NOW(). */
const SCHEDULED_REAL = `(${SCHEDULED_AKL} AT TIME ZONE 'Pacific/Auckland')`;

/** Real UTC instant a task becomes overdue: 30 minutes after its real scheduled time. */
const SCHEDULED_DEADLINE = `(${SCHEDULED_REAL} + interval '30 minutes')`;

/** Non-cancelled tasks with a scheduled time set (00:00 means time not set yet). */
const TIMED_SCHEDULED_TASK = `(t.scheduled_at IS NOT NULL AND ${SCHEDULED_AKL}::time <> '00:00' AND t.status <> 'cancelled')`;

/** Tasks whose Auckland scheduled time falls in [$1, $2), where $1/$2 are Auckland midnights. */
const SCHEDULED_IN_PERIOD = `${SCHEDULED_AKL} >= ($1::timestamptz AT TIME ZONE 'Pacific/Auckland') AND ${SCHEDULED_AKL} < ($2::timestamptz AT TIME ZONE 'Pacific/Auckland')`;

const toAucklandDate = (value: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not determine Auckland date for KPI bucketing');
  }
  return `${year}-${month}-${day}`;
};

const endOfDay = (date: Date): Date => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string): number => {
    const part = parts.find((entry) => entry.type === type)?.value;
    if (!part) {
      throw new Error(`Could not resolve ${type} in Pacific/Auckland`);
    }
    return Number(part);
  };

  return new Date(
    Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    ),
  );
};

/** Real UTC instant of Auckland midnight at the start of `date` (YYYY-MM-DD). */
const aucklandMidnight = (date: string): Date => {
  const guess = new Date(`${date}T00:00:00Z`);
  const offsetAt = (instant: Date): number => endOfDay(instant).getTime() - instant.getTime();
  const first = new Date(guess.getTime() - offsetAt(guess));
  return new Date(guess.getTime() - offsetAt(first));
};

/**
 * Resolves the UTC date range for a given period.
 * When period is 'today' and range is provided, expands to the last N days
 * (7, 30, or 90 depending on range).
 * Otherwise:
 * - 'today'  → start of today, end of today (Pacific/Auckland)
 * - 'week'   → Monday 00:00 to next Monday 00:00
 * - 'month'  → 1st of month to 1st of next month
 */
export const resolveKpiPeriod = (
  period: KpiPeriod,
  range?: KpiRange,
): { start: Date; end: Date } => {
  if (period === 'today' && range !== undefined) {
    const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const today = toAucklandDate(new Date());
    const startDay = new Date(`${today}T00:00:00Z`);
    startDay.setUTCDate(startDay.getUTCDate() - (days - 1));
    const nextDay = new Date(`${today}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const start = aucklandMidnight(startDay.toISOString().slice(0, 10));
    const end = aucklandMidnight(nextDay.toISOString().slice(0, 10));
    return { start, end };
  }

  const now = new Date();
  if (period === 'today') {
    const start = new Date(toAucklandDate(now));
    const end = endOfDay(new Date(toAucklandDate(now)));
    return { start, end };
  }

  if (period === 'week') {
    const formatter = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string): number => {
      const part = parts.find((entry) => entry.type === type)?.value;
      if (!part) {
        throw new Error(`Could not resolve ${type} in Pacific/Auckland`);
      }
      return Number(part);
    };

    const current = new Date(
      Date.UTC(
        getPart('year'),
        getPart('month') - 1,
        getPart('day'),
        getPart('hour'),
        getPart('minute'),
        getPart('second'),
      ),
    );
    const day = current.getUTCDay() || 7;
    current.setUTCDate(current.getUTCDate() - day + 1);
    const start = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
};

/**
 * Generates DD/MM day labels for a period, formatted in Pacific/Auckland.
 * - 'today' with range → N days (7/30/90) ending today
 * - 'today' without range → just today
 * - 'week' → 7 days starting Monday
 * - 'month' → all days in current calendar month
 */
export const generatePeriodDayLabels = (period: KpiPeriod, range?: KpiRange): string[] => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    month: '2-digit',
    day: '2-digit',
  });
  const formatLabel = (date: Date): string => {
    const parts = formatter.formatToParts(date);
    const day = parts.find((part) => part.type === 'day')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    if (!day || !month) {
      throw new Error('Could not format day label');
    }
    return `${day}/${month}`;
  };

  if (period === 'today') {
    const days =
      range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 1;
    const labels: string[] = [];
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - index);
      labels.push(formatLabel(date));
    }
    return labels;
  }

  if (period === 'week') {
    const current = new Date(now);
    const day = current.getUTCDay() || 7;
    current.setUTCDate(current.getUTCDate() - day + 1);
    const labels: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(current);
      date.setUTCDate(date.getUTCDate() + index);
      labels.push(formatLabel(date));
    }
    return labels;
  }

  const current = new Date(now);
  const currentMonthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  const currentMonthEnd = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1),
  );
  const labels: string[] = [];
  const cursor = new Date(currentMonthStart);
  while (cursor < currentMonthEnd) {
    labels.push(formatLabel(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return labels;
};

/**
 * Fetches all task records with extended fields within the resolved period.
 * Records are included if created before the period end and not yet completed
 * at the period start (catches tasks active during the window).
 * When period is 'today' and range is provided, the date window expands accordingly.
 */
export const findTaskKpiRecordsByPeriod = async (
  period: KpiPeriod,
  range?: KpiRange,
): Promise<TaskKpiRecord[]> => {
  const { start, end } = resolveKpiPeriod(period, range);
  const result = await pool.query<TaskKpiRecord>(
    `SELECT ${TASK_KPI_FIELDS} ${TASK_KPI_FROM} WHERE t.created_at < $2 AND (t.completed_at IS NULL OR t.completed_at >= $1)`,
    [start.toISOString(), end.toISOString()],
  );
  return result.rows;
};

/**
 * Fetches non-cancelled task records whose Auckland scheduled date falls within
 * the resolved period, regardless of when they were created or completed.
 * Tasks with no time set (00:00 placeholder) are included since their date is known.
 */
export const findScheduledTaskKpiRecordsByPeriod = async (
  period: KpiPeriod,
  range?: KpiRange,
): Promise<TaskKpiRecord[]> => {
  const { start, end } = resolveKpiPeriod(period, range);
  const result = await pool.query<TaskKpiRecord>(
    `SELECT ${TASK_KPI_FIELDS} ${TASK_KPI_FROM}
     WHERE t.scheduled_at IS NOT NULL
       AND t.status <> 'cancelled'
       AND ${SCHEDULED_IN_PERIOD}`,
    [start.toISOString(), end.toISOString()],
  );
  return result.rows;
};

/**
 * Fetches non-cancelled task records whose Auckland scheduled date is within
 * [startDate, endDate) (YYYY-MM-DD). Used by the daily summary, which covers fixed past days
 * instead of a range ending today.
 */
export const findScheduledTaskKpiRecordsBetween = async (
  startDate: string,
  endDate: string,
): Promise<TaskKpiRecord[]> => {
  const result = await pool.query<TaskKpiRecord>(
    `SELECT ${TASK_KPI_FIELDS} ${TASK_KPI_FROM}
     WHERE t.scheduled_at IS NOT NULL
       AND t.status <> 'cancelled'
       AND ${SCHEDULED_AKL} >= $1::date
       AND ${SCHEDULED_AKL} < $2::date`,
    [startDate, endDate],
  );
  return result.rows;
};

export const findTaskKpiRecords = async (): Promise<TaskKpiRecord[]> => {
  const result = await pool.query<TaskKpiRecord>(`SELECT ${TASK_KPI_FIELDS} ${TASK_KPI_FROM}`);
  return result.rows;
};

export const findKpiDashboardRecords = async (): Promise<null> => {
  return null;
};

/**
 * Fetches the Overdue Rate chart data via two SQL queries, both limited to
 * non-cancelled tasks with a scheduled time set, scheduled within the selected
 * range and grouped by their Auckland scheduled date:
 *
 * 1. Overdue count (bar) — completed tasks whose completed_at is after the real
 *    scheduled time, plus pending/in_progress tasks whose eal scheduled time + 30 minutes has passed.
 *
 * 2. On-time rate (line) — for each completed_at day among tasks created
 *    within the selected range, computes (on-time completions / total completions) * 100.
 *
 * Returns { label, primary, secondary } per day, with 0 for missing days.
 */
export const findOverdueRateByPeriod = async (
  period: KpiPeriod,
  range?: KpiRange,
): Promise<KpiOverduePoint[]> => {
  const { start, end } = resolveKpiPeriod(period, range);
  const labels = generatePeriodDayLabels(period, range);

  const resultMap = new Map<string, { primary: number; secondary: number }>();
  for (const label of labels) {
    resultMap.set(label, { primary: 0, secondary: 0 });
  }

  const overdueResult = await pool.query<{ label: string; primary: string }>(
    `SELECT
       to_char(${SCHEDULED_AKL}::date, 'DD/MM') AS label,
       COUNT(*) FILTER (
        WHERE (t.status = 'completed' AND date_trunc('minute', t.completed_at) > ${SCHEDULED_DEADLINE})
          OR (t.status IN ('pending', 'in_progress') AND date_trunc('minute', NOW()) > ${SCHEDULED_DEADLINE})
        ) AS primary
    FROM tasks t
    WHERE ${TIMED_SCHEDULED_TASK}
      AND ${SCHEDULED_IN_PERIOD}
    GROUP BY ${SCHEDULED_AKL}::date`,
    [start.toISOString(), end.toISOString()],
  );

  for (const row of overdueResult.rows) {
    if (resultMap.has(row.label)) {
      const existing = resultMap.get(row.label) as { primary: number; secondary: number };
      existing.primary = Number(row.primary) || 0;
    }
  }

  const onTimeResult = await pool.query<{ label: string; on_time: string; total: string }>(
    `SELECT
      to_char(${SCHEDULED_AKL}::date, 'DD/MM') AS label,
      COUNT(*) FILTER (WHERE date_trunc('minute', t.completed_at) <= ${SCHEDULED_DEADLINE}) AS on_time,
      COUNT(*) AS total
     FROM tasks t
     WHERE t.status = 'completed'
       AND t.completed_at IS NOT NULL
       AND ${TIMED_SCHEDULED_TASK}
       AND ${SCHEDULED_IN_PERIOD}
     GROUP BY ${SCHEDULED_AKL}::date`,
    [start.toISOString(), end.toISOString()],
  );

  for (const row of onTimeResult.rows) {
    if (resultMap.has(row.label)) {
      const existing = resultMap.get(row.label) as { primary: number; secondary: number };
      const onTime = Number(row.on_time) || 0;
      const total = Number(row.total) || 0;
      existing.secondary = total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : 0;
    }
  }

  return labels.map((label) => {
    const point = resultMap.get(label);
    return {
      label,
      primary: point?.primary ?? 0,
      secondary: point?.secondary ?? 0,
    };
  });
};
