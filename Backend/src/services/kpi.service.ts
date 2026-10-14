import {
  findOverdueRateByPeriod,
  findScheduledTaskKpiRecordsByPeriod,
  findTaskKpiRecordsByPeriod,
  generatePeriodDayLabels,
  type KpiCategoryPoint,
  type KpiChart,
  type KpiDashboardData,
  type KpiDualSeriesPoint,
  type KpiEmployeePoint,
  type KpiPetPoint,
  type KpiSeriesPoint,
  type KpiTripleSeriesPoint,
  type TaskKpiRecord,
} from '../repositories/kpi.repository.js';
import type { KpiRange } from '../contracts/kpi.contract.js';

const PACIFIC_AUCKLAND = 'Pacific/Auckland';

/** Converts a UTC Date to a YYYY-MM-DD string in Pacific/Auckland. */
const toAucklandDate = (value: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PACIFIC_AUCKLAND,
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

/** Converts a UTC Date to a DD/MM label in Pacific/Auckland (e.g. "13/09"). */
const toAucklandDayLabel = (value: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PACIFIC_AUCKLAND,
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!day || !month) {
    throw new Error('Could not format day label');
  }
  return `${day}/${month}`;
};

/** Returns the difference in minutes between two Dates. */
const diffMinutes = (start: Date, end: Date): number =>
  (end.getTime() - start.getTime()) / (60 * 1000);

/** Reads a UTC Date as Pacific/Auckland wall-clock time, returned in the UTC slot. */
const toAucklandWallClock = (instant: Date): Date => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: PACIFIC_AUCKLAND,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(instant);
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

/*
 * scheduled_at stores Auckland wall-clock time in the UTC slot
 * (09:00 Auckland → 09:00+00). Read its UTC fields for the Auckland date/time
 * and convert it with toRealScheduledTime before comparing with real instants.
 */

/** Returns the Auckland DD/MM label of a scheduled_at value without re-applying the offset. */
const toScheduledDayLabel = (scheduledAt: string): string => {
  const wallClock = new Date(scheduledAt);
  const day = String(wallClock.getUTCDate()).padStart(2, '0');
  const month = String(wallClock.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

/** Converts scheduled_at (Auckland wall-clock in the UTC slot) to its real UTC instant. */
export const toRealScheduledTime = (scheduledAt: string): Date => {
  const wallClock = new Date(scheduledAt);
  const offsetAt = (instant: Date): number =>
    toAucklandWallClock(instant).getTime() - instant.getTime();
  const guess = new Date(wallClock.getTime() - offsetAt(wallClock));
  return new Date(wallClock.getTime() - offsetAt(guess));
};

/** Returns false for the 00:00 placeholder (date known, time not set yet). */
export const hasScheduledTime = (scheduledAt: string): boolean => {
  const wallClock = new Date(scheduledAt);
  return wallClock.getUTCHours() !== 0 || wallClock.getUTCMinutes() !== 0;
};

/**
 * Determines whether a task was ever overdue, i.e. its scheduled time
 * has passed (for pending tasks) or it was completed past its scheduled
 * time (for completed tasks). Cancelled tasks are never overdue.
 */
const isTaskEverOverdue = (record: TaskKpiRecord): boolean => {
  if (!record.scheduled_at || record.status === 'cancelled') {
    return false;
  }

  const scheduled = new Date(record.scheduled_at);
  if (record.status === 'completed' && record.completed_at) {
    const completed = new Date(record.completed_at);
    return completed.getTime() > scheduled.getTime();
  }

  return new Date().getTime() > scheduled.getTime();
};

/**
 * Determines whether a task was completed on or before its scheduled time.
 * Tasks with no schedule that are completed are considered on time.
 * Cancelled pending tasks are treated as on time.
 */
const isTaskCompletedOnTime = (record: TaskKpiRecord): boolean => {
  if (!record.scheduled_at || record.status === 'cancelled') {
    return record.status === 'completed';
  }

  if (record.status !== 'completed' || !record.completed_at) {
    return false;
  }

  const scheduled = new Date(record.scheduled_at);
  const completed = new Date(record.completed_at);
  return completed.getTime() <= scheduled.getTime();
};

/**
 * Determines whether a task is still open (pending or in_progress).
 * Cancelled and completed tasks are not ongoing.
 */
const isTaskOngoing = (record: TaskKpiRecord): boolean => {
  if (record.status === 'cancelled') {
    return false;
  }

  if (record.status === 'completed') {
    return false;
  }

  return true;
};

/**
 * Computes the legacy metrics (completed rate, overdue composition)
 * for each day in the period.
 *
 * For each day, tracks:
 * - active:     tasks created that day (not cancelled)
 * - completed:  tasks completed that day
 * - completedOnTime: tasks completed on time (by completed date)
 * - ongoing:    tasks still open (by created date)
 * - overdue:    tasks ever overdue (by scheduled date)
 * - times:      completion durations in minutes (for avg computation)
 */
const computePeriodMetrics = (
  records: TaskKpiRecord[],
  range: KpiRange,
): Omit<KpiDashboardData['series'], 'overdueRate' | 'avgCompletionTime' | keyof NewChartSeries> => {
  const days = generatePeriodDayLabels('today', range);
  const metrics = new Map<
    string,
    {
      completedOnTime: number;
      ongoing: number;
      overdue: number;
      completed: number;
      active: number;
      times: number[];
    }
  >(
    days.map((date) => [
      date,
      { completedOnTime: 0, ongoing: 0, overdue: 0, completed: 0, active: 0, times: [] },
    ]),
  );

  for (const record of records) {
    const created = new Date(record.created_at);
    const createdDay = toAucklandDate(created);
    if (!metrics.has(createdDay)) {
      continue;
    }

    const isActive = record.status !== 'cancelled';
    if (isActive) {
      const metric = metrics.get(createdDay) as {
        completedOnTime: number;
        ongoing: number;
        overdue: number;
        completed: number;
        active: number;
        times: number[];
      };
      metric.active += 1;
    }

    if (record.status === 'completed' && record.completed_at) {
      const completed = new Date(record.completed_at);
      const completedDay = toAucklandDate(completed);
      if (metrics.has(completedDay)) {
        const metric = metrics.get(completedDay) as {
          completedOnTime: number;
          ongoing: number;
          overdue: number;
          completed: number;
          active: number;
          times: number[];
        };
        metric.completed += 1;

        if (record.scheduled_at) {
          const scheduled = new Date(record.scheduled_at);
          const minutes = diffMinutes(scheduled, completed);
          metric.times.push(minutes);
        }
      }
    }

    const completedOnTime = isTaskCompletedOnTime(record);
    const ongoing = isTaskOngoing(record);
    const overdue = isTaskEverOverdue(record);

    if (overdue) {
      const scheduled = new Date(record.scheduled_at as string);
      const overdueDay = toAucklandDate(scheduled);
      if (metrics.has(overdueDay)) {
        const metric = metrics.get(overdueDay) as {
          completedOnTime: number;
          ongoing: number;
          overdue: number;
          completed: number;
          active: number;
          times: number[];
        };
        metric.overdue += 1;
      }
    }

    if (completedOnTime) {
      const completed = new Date(record.completed_at as string);
      const completedDay = toAucklandDate(completed);
      if (metrics.has(completedDay)) {
        const metric = metrics.get(completedDay) as {
          completedOnTime: number;
          ongoing: number;
          overdue: number;
          completed: number;
          active: number;
          times: number[];
        };
        metric.completedOnTime += 1;
      }
    }

    if (ongoing) {
      const created = new Date(record.created_at);
      const createdDay = toAucklandDate(created);
      if (metrics.has(createdDay)) {
        const metric = metrics.get(createdDay) as {
          completedOnTime: number;
          ongoing: number;
          overdue: number;
          completed: number;
          active: number;
          times: number[];
        };
        metric.ongoing += 1;
      }
    }
  }

  const completedRate: KpiDashboardData['series']['completedRate'] = [];
  const overdueComposition: KpiDashboardData['series']['overdueComposition'] = [];

  for (const date of days) {
    const metric = metrics.get(date) as {
      completedOnTime: number;
      ongoing: number;
      overdue: number;
      completed: number;
      active: number;
      times: number[];
    };
    completedRate.push({
      label: date,
      value: metric.active > 0 ? Number(((metric.completed / metric.active) * 100).toFixed(1)) : 0,
    });
    overdueComposition.push({
      label: date,
      completedOnTime: metric.completedOnTime,
      ongoing: metric.ongoing,
      overdue: metric.overdue,
    });
  }

  return { completedRate, overdueComposition };
};

/**
 * Computes daily completion trend as a percentage: for each day, what %
 * of tasks created that day were completed that day.
 * whether finished early, on time or late.
 * Tasks without scheduled_at are excluded.
 * Uses range-based day labels (1, 7, 30, or 90 days ending today).
 */
const computeCompletionTrend = (records: TaskKpiRecord[], range: KpiRange): KpiSeriesPoint[] => {
  const dayLabels = generatePeriodDayLabels('today', range);
  const dayMap = new Map(dayLabels.map((label) => [label, { completed: 0, total: 0 }]));

  for (const record of records) {
    if (!record.scheduled_at || record.status === 'cancelled') {
      continue;
    }
    const scheduledLabel = toScheduledDayLabel(record.scheduled_at);
    if (dayMap.has(scheduledLabel)) {
      const entry = dayMap.get(scheduledLabel) as { completed: number; total: number };
      entry.total += 1;
      if (record.status === 'completed') {
        entry.completed += 1;
      }
    }
  }

  return dayLabels.map((label) => {
    const entry = dayMap.get(label) as { completed: number; total: number };
    const rate = entry.total > 0 ? Number(((entry.completed / entry.total) * 100).toFixed(1)) : 0;
    return { label, value: rate };
  });
};

/**
 * Computes the average completion time (minutes) for completed tasks,
 * bucketed by the day they were completed.
 * Time is measured from the later of created_at and scheduled_at to completed_at,
 * so tasks booked in advance do not count the wait before their scheduled time.
 * Completions before that start count as 0 minutes; tasks without scheduled_at are excluded.
 * with no time set (00:00 placeholder) are excluded.
 * Uses range-based day labels (7, 30, or 90 days from 'today').
 */
const computeAvgCompletionTime = (records: TaskKpiRecord[], range: KpiRange): KpiSeriesPoint[] => {
  const dayLabels = generatePeriodDayLabels('today', range);
  const dayMap = new Map(dayLabels.map((label) => [label, { sum: 0, count: 0 }]));

  for (const record of records) {
    if (
      record.status !== 'completed' ||
      !record.completed_at ||
      !record.scheduled_at ||
      !hasScheduledTime(record.scheduled_at)
    ) {
      continue;
    }
    const label = toAucklandDayLabel(new Date(record.completed_at));
    if (dayMap.has(label)) {
      const entry = dayMap.get(label) as { sum: number; count: number };
      const startedAt = new Date(
        Math.max(
          new Date(record.created_at).getTime(),
          toRealScheduledTime(record.scheduled_at).getTime(),
        ),
      );
      entry.sum += Math.max(0, diffMinutes(startedAt, new Date(record.completed_at)));
      entry.count += 1;
    }
  }

  return dayLabels.map((label) => {
    const entry = dayMap.get(label) as { sum: number; count: number };
    return {
      label,
      value: entry.count > 0 ? Number((entry.sum / entry.count).toFixed(0)) : 0,
    };
  });
};

/** Booking task titles (task.fromBooking.mapping.ts) mapped to KPI categories. */
const BOOKING_TITLE_CATEGORIES: Record<string, string> = {
  Grooming: 'Grooming',
  'Outdoor Walk': 'Walking',
  'Medication Administration': 'Medical',
  'Extra Playtime': 'Playtime',
};

/** tasks.category values set by daily routines, mapped to the same KPI categories. */
const TASK_CATEGORY_LABELS: Record<string, string> = {
  feeding: 'Feeding',
  medication: 'Medical',
  grooming: 'Grooming',
  exercise: 'Walking',
  enrichment: 'Playtime',
  potty: 'Potty',
  wellness: 'Wellness',
};

/** The task fields used to pick a KPI category. */
export interface KpiCategorySource {
  title: string;
  category: string | null;
}

/**
 * Classifies a task. Routine tasks carry a tasks.category; booking tasks are 'custom', so they are
 * classified by their booking title. Anything else falls into 'Other'.
 */
export const toKpiCategory = (task: KpiCategorySource): string => {
  const fromCategory = task.category
    ? TASK_CATEGORY_LABELS[task.category.trim().toLowerCase()]
    : undefined;
  if (fromCategory) {
    return fromCategory;
  }
  if (task.title.startsWith('Feeding (')) {
    return 'Feeding';
  }
  return BOOKING_TITLE_CATEGORIES[task.title] ?? 'Other';
};

/** Counts non-cancelled tasks scheduled in the period per booking-title category, sorted by count descending. */
const computeCategoryDistribution = (records: TaskKpiRecord[]): KpiCategoryPoint[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.status === 'cancelled') {
      continue;
    }
    const category = toKpiCategory(record);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/** Counts non-cancelled tasks per priority (capitalized label), sorted by count. */
const computePriorityBreakdown = (records: TaskKpiRecord[]): KpiCategoryPoint[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.status === 'cancelled') {
      continue;
    }
    const priority = record.priority.charAt(0).toUpperCase() + record.priority.slice(1);
    counts.set(priority, (counts.get(priority) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/** Counts non-cancelled tasks scheduled in the period per assigned staff member, sorted by count. Uses 'Unassigned' for tasks with no staff. */
const computeTasksPerEmployee = (records: TaskKpiRecord[]): KpiEmployeePoint[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.status === 'cancelled') {
      continue;
    }
    const name = record.staff_name ?? 'Unassigned';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/** Counts tasks per current status (pending, in_progress, completed, cancelled), sorted by count. */
const computeStatusOverview = (records: TaskKpiRecord[]): KpiCategoryPoint[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Computes scheduled vs completed counts per Auckland scheduled date.
 * - primary (bar):   non-cancelled tasks scheduled on that day (tasks with no time set included)
 * - secondary (line): those same tasks that are completed, early or late
 * Uses range-based day labels (1/7/30/90 days ending today).
 */
const computeScheduledVsCompleted = (
  records: TaskKpiRecord[],
  range: KpiRange,
): KpiDualSeriesPoint[] => {
  const dayLabels = generatePeriodDayLabels('today', range);
  const dayMap = new Map(dayLabels.map((label) => [label, { primary: 0, secondary: 0 }]));

  for (const record of records) {
    if (!record.scheduled_at || record.status === 'cancelled') {
      continue;
    }
    const scheduledLabel = toScheduledDayLabel(record.scheduled_at);
    if (dayMap.has(scheduledLabel)) {
      const entry = dayMap.get(scheduledLabel) as { primary: number; secondary: number };
      entry.primary += 1;
      if (record.status === 'completed') {
        entry.secondary += 1;
      }
    }
    if (record.status === 'completed' && record.completed_at) {
      const completedLabel = toAucklandDayLabel(new Date(record.completed_at));
      if (dayMap.has(completedLabel)) {
        const entry = dayMap.get(completedLabel) as { primary: number; secondary: number };
        entry.secondary += 1;
      }
    }
  }

  return dayLabels.map((label) => {
    const entry = dayMap.get(label) as { primary: number; secondary: number };
    return { label, primary: entry.primary, secondary: entry.secondary };
  });
};
/** Minutes after the real scheduled time before a task counts as overdue. */
export const OVERDUE_GRACE_MINUTES = 30;

/** Drops the seconds, so overdue is judged to the minute as shown on screen (09:30:40 is 09:30). */
export const toMinuteTime = (value: Date | string): number =>
  Math.floor(new Date(value).getTime() / 60_000) * 60_000;

/** Delay histogram bucket thresholds: 0-10m, 10-30m, 30-60m, 1-2h, 2-4h, 4h+. */
const DELAY_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-10m', min: 0, max: 10 },
  { label: '10-30m', min: 10, max: 30 },
  { label: '30-60m', min: 30, max: 60 },
  { label: '1-2h', min: 60, max: 120 },
  { label: '2-4h', min: 120, max: 240 },
  { label: '4h+', min: 240, max: Infinity },
];

/**
 * Computes a histogram of completion delays: how many tasks fell into
 * each delay bucket (0-10m, 10-30m, etc.).
 * Delay = completed_at − (real scheduled time + 30-minute grace). Only completed tasks with a
 * scheduled time set are included (00:00 placeholder excluded); on-time and
 * early completions (delay ≤ 0) are excluded.
 */
const computeAvgDelayTime = (records: TaskKpiRecord[]): KpiSeriesPoint[] => {
  const counts = new Map(DELAY_BUCKETS.map((b) => [b.label, 0]));

  for (const record of records) {
    if (
      record.status === 'completed' &&
      record.scheduled_at &&
      record.completed_at &&
      hasScheduledTime(record.scheduled_at)
    ) {
      const scheduled = toRealScheduledTime(record.scheduled_at);
      const completed = new Date(toMinuteTime(record.completed_at));
      const delay = diffMinutes(scheduled, completed) - OVERDUE_GRACE_MINUTES;
      if (delay > 0) {
        const bucket = DELAY_BUCKETS.find((b) => delay >= b.min && delay < b.max);
        const label = bucket?.label ?? '4h+';
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }

  return DELAY_BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: counts.get(bucket.label) ?? 0,
  }));
};

/** Counts non-cancelled tasks per pet name, sorted by count. Uses 'Unknown' for tasks with no pet. */
const computeTasksByPet = (records: TaskKpiRecord[]): KpiPetPoint[] => {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.status === 'cancelled') {
      continue;
    }
    const name = record.pet_name ?? 'Unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Compares staff vs pet tasks scheduled in the period per booking-title category.
 * - primary (staff bar): count of task_type='staff' tasks
 * - secondary (pet bar):  count of task_type='pet' tasks
 * Sorted by total count descending.
 */
const computeTaskTypeComparison = (records: TaskKpiRecord[]): KpiDualSeriesPoint[] => {
  const counts = new Map<string, { staff: number; pet: number }>();

  for (const record of records) {
    if (record.status === 'cancelled') {
      continue;
    }
    const category = toKpiCategory(record);
    if (!counts.has(category)) {
      counts.set(category, { staff: 0, pet: 0 });
    }
    const entry = counts.get(category) as { staff: number; pet: number };
    if (record.task_type === 'staff') {
      entry.staff += 1;
    } else {
      entry.pet += 1;
    }
  }

  return Array.from(counts.entries())
    .map(([label, counts]) => ({
      label,
      primary: counts.staff,
      secondary: counts.pet,
    }))
    .sort((a, b) => b.primary + b.secondary - (a.primary + a.secondary));
};

/**
 * Computes the count of newly created tasks per day (bucketed by created_at).
 * Uses period-based day labels.
 */
const computeCreationTrend = (records: TaskKpiRecord[], range: KpiRange): KpiSeriesPoint[] => {
  const dayLabels = generatePeriodDayLabels('today', range);
  const dayMap = new Map(dayLabels.map((label) => [label, 0]));

  for (const record of records) {
    const label = toAucklandDayLabel(new Date(record.created_at));
    if (dayMap.has(label)) {
      dayMap.set(label, (dayMap.get(label) as number) + 1);
    }
  }

  return dayLabels.map((label) => ({
    label,
    value: dayMap.get(label) as number,
  }));
};

/**
 * Computes the on-time completion rate (%) per Auckland scheduled date split by priority.
 * Among completed tasks with a scheduled time set (00:00 placeholder excluded), a task is
 * on time when completed_at is at or before the real scheduled time + the 30-minute grace.
 * - high:   'high' and 'urgent' priority tasks
 * - medium: 'mid' priority tasks
 * - low:    'low' priority tasks
 * Days with no completed tasks for a priority show 0.
 */
const computeCompletionEfficiencyByPriority = (
  records: TaskKpiRecord[],
  range: KpiRange,
): KpiTripleSeriesPoint[] => {
  type RateCounts = { onTime: number; total: number };
  type PriorityCounts = { high: RateCounts; medium: RateCounts; low: RateCounts };

  const dayLabels = generatePeriodDayLabels('today', range);
  const dayMap = new Map<string, PriorityCounts>(
    dayLabels.map((label) => [
      label,
      {
        high: { onTime: 0, total: 0 },
        medium: { onTime: 0, total: 0 },
        low: { onTime: 0, total: 0 },
      },
    ]),
  );
  for (const record of records) {
    if (
      record.status !== 'completed' ||
      !record.scheduled_at ||
      !record.completed_at ||
      !hasScheduledTime(record.scheduled_at)
    ) {
      continue;
    }

    const entry = dayMap.get(toScheduledDayLabel(record.scheduled_at));
    if (!entry) {
      continue;
    }

    const counts =
      record.priority === 'high' || record.priority === 'urgent'
        ? entry.high
        : record.priority === 'mid'
          ? entry.medium
          : record.priority === 'low'
            ? entry.low
            : null;
    if (!counts) {
      continue;
    }
    const deadline =
      toRealScheduledTime(record.scheduled_at).getTime() + OVERDUE_GRACE_MINUTES * 60 * 1000;
    counts.total += 1;
    if (toMinuteTime(record.completed_at) <= deadline) {
      counts.onTime += 1;
    }
  }

  const toRate = ({ onTime, total }: RateCounts): number =>
    total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : 0;

  return dayLabels.map((label) => {
    const entry = dayMap.get(label) as PriorityCounts;
    return {
      label,
      high: toRate(entry.high),
      medium: toRate(entry.medium),
      low: toRate(entry.low),
    };
  });
};

interface NewChartSeries {
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
}

/**
 * Computes the KPI dashboard data for today with a given day range.
 *
 * Fetches task records from the database and computes all 13 chart series
 * plus the legacy 3-chart metrics (completed rate, overdue composition,
 * average completion time).
 *
 * Timezone handling: all date bucketing uses Pacific/Auckland to match
 * the facility's local wall-clock time.
 *
 * @param range - The day range for today's data ('today' = 1 day,
 *                '7d' = 7 days, '30d' = 30 days, '90d' = 90 days).
 * @returns A KpiDashboardData object containing all chart series.
 */
export const getKpiDashboard = async (range: KpiRange = 'today'): Promise<KpiDashboardData> => {
  const records = await findTaskKpiRecordsByPeriod('today', range);
  const scheduledRecords = await findScheduledTaskKpiRecordsByPeriod('today', range);
  const series = computePeriodMetrics(records, range);
  const overdueRate = await findOverdueRateByPeriod('today', range);

  const charts: KpiChart[] = [
    { id: 'completed-rate', title: 'Task completed rate' },
    { id: 'overdue-composition', title: 'Overdue composition' },
    { id: 'avg-completion-time', title: 'Average completion time' },
    { id: 'overdue-rate', title: 'Overdue Rate' },
  ];

  return {
    period: 'today',
    charts,
    series: {
      completedRate: series.completedRate,
      overdueComposition: series.overdueComposition,
      avgCompletionTime: computeAvgCompletionTime(records, range),
      overdueRate,
      completionTrend: computeCompletionTrend(scheduledRecords, range),
      categoryDistribution: computeCategoryDistribution(scheduledRecords),
      priorityBreakdown: computePriorityBreakdown(records),
      tasksPerEmployee: computeTasksPerEmployee(scheduledRecords),
      statusOverview: computeStatusOverview(records),
      scheduledVsCompleted: computeScheduledVsCompleted(scheduledRecords, range),
      avgDelayTime: computeAvgDelayTime(records),
      tasksByPet: computeTasksByPet(records),
      taskTypeComparison: computeTaskTypeComparison(scheduledRecords),
      creationTrend: computeCreationTrend(records, range),
      completionEfficiencyByPriority: computeCompletionEfficiencyByPriority(
        scheduledRecords,
        range,
      ),
    },
  };
};
