import {
  REPORT_PRIORITIES,
  type KpiReportFigures,
  type ReportPriority,
} from './kpi.report.figures.js';
import { REPORT_PERIOD_UNITS, type KpiReportType } from './kpi.report.periods.js';

type KeyNumber =
  | 'completionRate'
  | 'overdueRate'
  | 'onTimeRate'
  | 'avgCompletionMinutes'
  | 'avgDelayMinutes'
  | 'scheduled'
  | 'created';

type Unit = '%' | 'm' | '';

interface KeyNumberDefinition {
  key: KeyNumber;
  label: string;
  unit: Unit;
  /** Which direction is better; null when neither (task volume). */
  better: 'higher' | 'lower' | null;
}

const KEY_NUMBERS: KeyNumberDefinition[] = [
  { key: 'completionRate', label: 'Completion rate', unit: '%', better: 'higher' },
  { key: 'overdueRate', label: 'Overdue rate', unit: '%', better: 'lower' },
  { key: 'onTimeRate', label: 'On-time rate', unit: '%', better: 'higher' },
  { key: 'avgCompletionMinutes', label: 'Avg completion time', unit: 'm', better: 'lower' },
  { key: 'avgDelayMinutes', label: 'Avg delay', unit: 'm', better: 'lower' },
  { key: 'scheduled', label: 'Tasks scheduled', unit: '', better: null },
  { key: 'created', label: 'Tasks created', unit: '', better: null },
];

export interface KeyNumberChange {
  key: KeyNumber;
  label: string;
  unit: Unit;
  current: number | null;
  previous: number | null;
  /** current - previous (percentage points for rates). */
  change: number | null;
  worse: boolean;
}

/** Key numbers for the report table: this period vs the previous one. */
export const compareKeyNumbers = (
  current: KpiReportFigures,
  previous: KpiReportFigures,
): KeyNumberChange[] =>
  KEY_NUMBERS.map(({ key, label, unit, better }) => {
    const currentValue = current[key];
    const previousValue = previous[key];
    const change =
      currentValue !== null && previousValue !== null
        ? Number((currentValue - previousValue).toFixed(1))
        : null;
    const worse =
      change !== null && better !== null && (better === 'higher' ? change < 0 : change > 0);
    return { key, label, unit, current: currentValue, previous: previousValue, change, worse };
  });

const PRIORITY_LABELS: Record<ReportPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const largest = <T>(items: T[], size: (item: T) => number): T | undefined =>
  items.filter((item) => size(item) > 0).sort((a, b) => size(b) - size(a))[0];

/**
 * Up to three biggest changes: the category whose overdue count moved most, the priority whose
 * on-time rate moved most, and the category whose task volume moved most.
 */
export const findBiggestMovers = (
  current: KpiReportFigures,
  previous: KpiReportFigures,
): string[] => {
  const categories = [
    ...new Set([...Object.keys(current.categories), ...Object.keys(previous.categories)]),
  ];
  const overdueOf = (figures: KpiReportFigures, category: string): number =>
    figures.categories[category]?.overdue ?? 0;
  const volumeOf = (figures: KpiReportFigures, category: string): number =>
    figures.categories[category]?.scheduled ?? 0;
  const onTimeChange = (priority: ReportPriority): number => {
    const now = current.priorities[priority].onTimeRate;
    const before = previous.priorities[priority].onTimeRate;
    return now !== null && before !== null ? Math.abs(now - before) : 0;
  };

  const overdueMover = largest(categories, (category) =>
    Math.abs(overdueOf(current, category) - overdueOf(previous, category)),
  );
  const priorityMover = largest([...REPORT_PRIORITIES], onTimeChange);
  const volumeMover = largest(
    categories.filter((category) => category !== overdueMover),
    (category) => Math.abs(volumeOf(current, category) - volumeOf(previous, category)),
  );

  const movers: string[] = [];
  if (overdueMover) {
    movers.push(
      `${overdueMover} overdue ${overdueOf(previous, overdueMover)} → ${overdueOf(current, overdueMover)}`,
    );
  }
  if (priorityMover) {
    movers.push(
      `${PRIORITY_LABELS[priorityMover]} priority on-time ${previous.priorities[priorityMover].onTimeRate}% → ${current.priorities[priorityMover].onTimeRate}%`,
    );
  }
  if (volumeMover) {
    movers.push(
      `${volumeMover} tasks ${volumeOf(previous, volumeMover)} → ${volumeOf(current, volumeMover)}`,
    );
  }
  return movers;
};

type TrendKey = 'avgCompletionMinutes' | 'overdueRate' | 'onTimeRate' | 'completionRate';

const TRENDS: Array<{ key: TrendKey; label: string; worseWhen: 'up' | 'down'; unit: Unit }> = [
  { key: 'avgCompletionMinutes', label: 'Average completion time', worseWhen: 'up', unit: 'm' },
  { key: 'overdueRate', label: 'Overdue rate', worseWhen: 'up', unit: '%' },
  { key: 'onTimeRate', label: 'On-time rate', worseWhen: 'down', unit: '%' },
  { key: 'completionRate', label: 'Completion rate', worseWhen: 'down', unit: '%' },
];

/** "Up three weeks in a row" needs four periods: three changes in the same bad direction. */
export const TREND_PERIODS = 4;

const isWorsening = (values: number[], worseWhen: 'up' | 'down'): boolean =>
  values.slice(1).every((value, index) => {
    const before = values[index];
    return before !== undefined && (worseWhen === 'up' ? value > before : value < before);
  });

/**
 * Trend warnings for the top of the report. `history` runs oldest to newest and ends with the
 * current period; a metric is flagged when it got worse in each of the last three periods.
 */
export const findTrendWarnings = (history: KpiReportFigures[], type: KpiReportType): string[] => {
  const recent = history.slice(-TREND_PERIODS);
  if (recent.length < TREND_PERIODS) {
    return [];
  }
  const unitName = REPORT_PERIOD_UNITS[type];
  return TRENDS.flatMap(({ key, label, worseWhen, unit }) => {
    const values = recent.map((figures) => figures[key]);
    if (values.some((value) => value === null)) {
      return [];
    }
    const numbers = values as number[];
    if (!isWorsening(numbers, worseWhen)) {
      return [];
    }
    return [
      `${label} ${worseWhen} ${TREND_PERIODS - 1} ${unitName} in a row (${numbers
        .map((value) => `${value}${unit}`)
        .join(' → ')})`,
    ];
  });
};
