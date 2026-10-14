import React, { useState } from 'react';
import type { GoogleReviewDashboardFlowPoint } from '../../../types/googleReviewDashboard';
import { FeedbackFlowTooltip } from './FeedbackFlowTooltip';
import {
  createPath,
  FEEDBACK_FLOW_CHART,
  formatHalfMonthLabel,
  getChartMaxValue,
  getPeriodTargetWidth,
  getPointPosition,
  getPointX,
  getYAxisTicks,
} from './feedbackFlowChart.utils';

interface FeedbackFlowPlotProps {
  points: readonly GoogleReviewDashboardFlowPoint[];
}

export const FeedbackFlowPlot: React.FC<FeedbackFlowPlotProps> = ({ points }) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const maxValue = getChartMaxValue(points);
  const yTicks = getYAxisTicks(maxValue);
  const plotHeight =
    FEEDBACK_FLOW_CHART.height -
    FEEDBACK_FLOW_CHART.padding.top -
    FEEDBACK_FLOW_CHART.padding.bottom;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = activePointIndex === null ? undefined : points[activePointIndex];

  return (
    <svg
      role="group"
      aria-label="Half-month received and replied Google review counts"
      className="h-auto w-full"
      viewBox={`0 0 ${FEEDBACK_FLOW_CHART.width} ${FEEDBACK_FLOW_CHART.height}`}
    >
      {yTicks.map((tick) => {
        const y = FEEDBACK_FLOW_CHART.padding.top + plotHeight - (tick / maxValue) * plotHeight;
        return (
          <g key={tick}>
            <line
              x1={FEEDBACK_FLOW_CHART.padding.left}
              x2={FEEDBACK_FLOW_CHART.width - FEEDBACK_FLOW_CHART.padding.right}
              y1={y}
              y2={y}
              stroke="#eee3da"
              strokeWidth="1"
            />
            <text
              x={FEEDBACK_FLOW_CHART.padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-notice-muted type-meta"
            >
              {tick}
            </text>
          </g>
        );
      })}
      <line
        x1={FEEDBACK_FLOW_CHART.padding.left}
        x2={FEEDBACK_FLOW_CHART.width - FEEDBACK_FLOW_CHART.padding.right}
        y1={FEEDBACK_FLOW_CHART.height - FEEDBACK_FLOW_CHART.padding.bottom}
        y2={FEEDBACK_FLOW_CHART.height - FEEDBACK_FLOW_CHART.padding.bottom}
        stroke="#bda99b"
        strokeWidth="1.5"
      />
      <path
        d={createPath(
          points.map((point) => point.receivedCount),
          maxValue,
        )}
        fill="none"
        stroke={FEEDBACK_FLOW_CHART.receivedColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={createPath(
          points.map((point) => point.repliedCount),
          maxValue,
        )}
        fill="none"
        stroke={FEEDBACK_FLOW_CHART.repliedColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => {
        const receivedPosition = getPointPosition(
          index,
          point.receivedCount,
          points.length,
          maxValue,
        );
        const repliedPosition = getPointPosition(
          index,
          point.repliedCount,
          points.length,
          maxValue,
        );
        return (
          <g key={point.periodStart}>
            <circle
              cx={receivedPosition.x}
              cy={receivedPosition.y}
              r="4.5"
              fill={FEEDBACK_FLOW_CHART.receivedColor}
            />
            <circle
              cx={repliedPosition.x}
              cy={repliedPosition.y}
              r="4.5"
              fill={FEEDBACK_FLOW_CHART.repliedColor}
            />
            {(index % labelEvery === 0 || index === points.length - 1) && (
              <text
                x={receivedPosition.x}
                y={FEEDBACK_FLOW_CHART.height - 10}
                textAnchor="middle"
                className="fill-notice-muted type-meta"
              >
                {formatHalfMonthLabel(point.periodStart)}
              </text>
            )}
          </g>
        );
      })}
      {points.map((point, index) => {
        const pointX = getPointX(index, points.length);
        const targetWidth = getPeriodTargetWidth(index, points.length);
        const tooltipId = `feedback-flow-tooltip-${point.periodStart}`;
        return (
          <rect
            key={`target-${point.periodStart}`}
            x={pointX - targetWidth / 2}
            y={FEEDBACK_FLOW_CHART.padding.top}
            width={targetWidth}
            height={plotHeight}
            fill="transparent"
            data-testid={`feedback-flow-period-${point.periodStart}`}
            role="button"
            tabIndex={0}
            aria-label={`${formatHalfMonthLabel(point.periodStart)}: Received ${point.receivedCount}, Replied ${point.repliedCount}`}
            aria-describedby={activePointIndex === index ? tooltipId : undefined}
            aria-expanded={activePointIndex === index}
            onMouseEnter={() => setActivePointIndex(index)}
            onMouseLeave={() => setActivePointIndex(null)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.currentTarget.blur();
            }}
            onFocus={() => setActivePointIndex(index)}
            onBlur={() => setActivePointIndex(null)}
            onClick={() =>
              setActivePointIndex((currentIndex) => (currentIndex === index ? null : index))
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setActivePointIndex(null);
              }
            }}
          />
        );
      })}
      {activePoint && activePointIndex !== null && (
        <FeedbackFlowTooltip
          point={activePoint}
          pointX={getPointX(activePointIndex, points.length)}
        />
      )}
    </svg>
  );
};
