import React from 'react';
import type { GoogleReviewDashboard } from '../../../types/googleReviewDashboard';
import { DashboardVisualHelp } from './DashboardVisualHelp';
import { FeedbackFlowPlot } from './FeedbackFlowPlot';
import { FEEDBACK_FLOW_CHART, trimLeadingEmptyPoints } from './feedbackFlowChart.utils';

interface FeedbackFlowChartProps {
  flow: GoogleReviewDashboard['feedbackFlow'];
}

export const FeedbackFlowChart: React.FC<FeedbackFlowChartProps> = ({ flow }) => {
  const visiblePoints = trimLeadingEmptyPoints(flow.points);

  return (
    <section
      aria-labelledby="feedback-flow-heading"
      className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6"
      data-testid="feedback-flow-section"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="feedback-flow-heading" className="type-eyebrow text-theme-earth">
              FEEDBACK FLOW
            </h2>
            <DashboardVisualHelp
              visualName="Feedback Flow"
              note="Compares reviews received and reviews replied to by half-month. Use it to monitor incoming review volume and reply activity over time; it is not a reply rate for the same reviews."
            />
          </div>
          <p className="mt-2 type-body text-notice-muted">Received vs replied by half-month</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 type-meta text-notice-muted">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FEEDBACK_FLOW_CHART.receivedColor }}
            />
            Received
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FEEDBACK_FLOW_CHART.repliedColor }}
            />
            Replied
          </span>
        </div>
      </div>

      {visiblePoints.length === 0 ? (
        <p className="py-10 text-center type-body text-notice-muted">
          No half-month activity in the selected period.
        </p>
      ) : (
        <FeedbackFlowPlot points={visiblePoints} />
      )}
    </section>
  );
};
