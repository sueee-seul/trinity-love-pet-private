import React from 'react';
import type { GoogleReviewDashboardFlowPoint } from '../../../types/googleReviewDashboard';
import { FEEDBACK_FLOW_CHART, formatHalfMonthLabel, getTooltipX } from './feedbackFlowChart.utils';

interface FeedbackFlowTooltipProps {
  point: GoogleReviewDashboardFlowPoint;
  pointX: number;
}

export const FeedbackFlowTooltip: React.FC<FeedbackFlowTooltipProps> = ({ point, pointX }) => {
  const tooltipX = getTooltipX(pointX);

  return (
    <g id={`feedback-flow-tooltip-${point.periodStart}`} role="tooltip" pointerEvents="none">
      <rect
        x={tooltipX}
        y="4"
        width={FEEDBACK_FLOW_CHART.tooltipWidth}
        height={FEEDBACK_FLOW_CHART.tooltipHeight}
        rx="8"
        fill="#3f3027"
      />
      <text
        x={tooltipX + FEEDBACK_FLOW_CHART.tooltipWidth / 2}
        y="21"
        textAnchor="middle"
        className="fill-white type-meta font-semibold"
      >
        {formatHalfMonthLabel(point.periodStart)}
      </text>
      <text x={tooltipX + 12} y="39" className="fill-white type-meta">
        Received: {point.receivedCount}
      </text>
      <text x={tooltipX + 12} y="54" className="fill-white type-meta">
        Replied: {point.repliedCount}
      </text>
    </g>
  );
};
