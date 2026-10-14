import type { GoogleReviewDashboardFlowPoint } from '../../../types/googleReviewDashboard';

export const FEEDBACK_FLOW_CHART = {
  width: 720,
  height: 220,
  padding: { top: 20, right: 16, bottom: 34, left: 34 },
  receivedColor: '#4d83c4',
  repliedColor: '#6b9c70',
  tooltipWidth: 156,
  tooltipHeight: 62,
} as const;

interface FeedbackFlowPointPosition {
  x: number;
  y: number;
}

export const formatHalfMonthLabel = (periodStart: string): string => {
  const [year, month, day] = periodStart.split('-').map(Number);
  const monthDate = new Date(Date.UTC(year, month - 1, 12));
  const monthLabel = new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    timeZone: 'UTC',
  }).format(monthDate);
  const endDay = day === 1 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthLabel} ${day} to ${endDay}`;
};

export const trimLeadingEmptyPoints = (
  points: readonly GoogleReviewDashboardFlowPoint[],
): GoogleReviewDashboardFlowPoint[] => {
  const firstActiveIndex = points.findIndex(
    (point) => point.receivedCount > 0 || point.repliedCount > 0,
  );
  return firstActiveIndex === -1 ? [] : points.slice(firstActiveIndex);
};

export const getChartMaxValue = (points: readonly GoogleReviewDashboardFlowPoint[]): number => {
  const highestValue = Math.max(
    0,
    ...points.flatMap((point) => [point.receivedCount, point.repliedCount]),
  );
  return Math.max(4, highestValue);
};

export const getYAxisTicks = (maxValue: number): number[] => {
  return [...new Set([0, Math.round(maxValue / 2), maxValue])];
};

export const createPath = (values: readonly number[], maxValue: number): string => {
  if (values.length === 0) {
    return '';
  }

  const { width, height, padding } = FEEDBACK_FLOW_CHART;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = padding.left + (index / denominator) * plotWidth;
      const y = padding.top + plotHeight - (value / maxValue) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

export const getPointPosition = (
  index: number,
  value: number,
  pointCount: number,
  maxValue: number,
): FeedbackFlowPointPosition => {
  const { width, height, padding } = FEEDBACK_FLOW_CHART;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(pointCount - 1, 1);
  return {
    x: padding.left + (index / denominator) * plotWidth,
    y: padding.top + plotHeight - (value / maxValue) * plotHeight,
  };
};

export const getPointX = (index: number, pointCount: number): number => {
  const { width, padding } = FEEDBACK_FLOW_CHART;
  const plotWidth = width - padding.left - padding.right;
  const denominator = Math.max(pointCount - 1, 1);
  return padding.left + (index / denominator) * plotWidth;
};

export const getPeriodTargetWidth = (index: number, pointCount: number): number => {
  const { width, padding } = FEEDBACK_FLOW_CHART;
  const plotWidth = width - padding.left - padding.right;
  if (pointCount <= 1) {
    return plotWidth;
  }

  const pointSpacing = plotWidth / (pointCount - 1);
  return index === 0 || index === pointCount - 1 ? pointSpacing / 2 : pointSpacing;
};

export const getTooltipX = (pointX: number): number => {
  const { width, tooltipWidth } = FEEDBACK_FLOW_CHART;
  return Math.min(Math.max(pointX - tooltipWidth / 2, 4), width - tooltipWidth - 4);
};
