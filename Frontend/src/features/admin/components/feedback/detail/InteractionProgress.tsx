import React from 'react';
import type { AdminFeedback, FeedbackProgressStep, TimelineEvent } from '../../../types/feedback';

interface InteractionProgressProps {
  feedback: AdminFeedback;
}

const PROGRESS_STEP_ORDER: Record<FeedbackProgressStep, number> = {
  submitted: 0,
  review_started: 1,
  fact_checked: 2,
  sent: 3,
};

const formatSubmissionTimestamp = (timestamp: number): string => {
  return new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Pacific/Auckland',
  }).format(timestamp);
};

export const InteractionProgress: React.FC<InteractionProgressProps> = ({ feedback }) => {
  const getTimelineEvent = (step: FeedbackProgressStep): TimelineEvent | undefined => {
    return feedback.timeline?.find((t) => t.step === step);
  };
  const serviceDescription = feedback.serviceType ? ` for ${feedback.serviceType}` : '';

  const stepsConfig: { step: FeedbackProgressStep; title: string; defaultDesc: string }[] = [
    {
      step: 'submitted',
      title: 'Feedback Submitted',
      defaultDesc: `${feedback.parentName} submitted feedback${serviceDescription} with ${feedback.petName}.`,
    },
    {
      step: 'review_started',
      title: 'Staff Review Started',
      defaultDesc: 'Staff opened the feedback record for manual review.',
    },
    {
      step: 'fact_checked',
      title: 'Fact Check Completed',
      defaultDesc:
        'Staff verified the walk record and internal logs to confirm the context of the feedback.',
    },
    {
      step: 'sent',
      title: 'Response Sent to Parent',
      defaultDesc: `Awaiting final approval and transmission to ${feedback.parentName}.`,
    },
  ];

  return (
    <div className="border border-border-soft rounded-xl p-8 mb-8 shadow-sm bg-surface-card">
      <h3 className="type-card-title mb-8">Interaction Progress</h3>

      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[11px] top-3 bottom-6 w-[2px] bg-surface-bubbles" />

        <div className="flex flex-col gap-8">
          {stepsConfig.map((config) => {
            const event = getTimelineEvent(config.step);
            const isCompleted =
              !!event ||
              PROGRESS_STEP_ORDER[feedback.current_status] >= PROGRESS_STEP_ORDER[config.step];
            const statusLabel = event
              ? `${event.timestamp} • ${event.actor}`
              : isCompleted && config.step === 'submitted'
                ? `Submitted on ${formatSubmissionTimestamp(feedback.timestamp)} • System`
                : isCompleted
                  ? 'Completed'
                  : 'Pending';
            return (
              <div key={config.step} className="flex gap-6 relative">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-accent-foreground flex items-center justify-center relative z-10 ring-4 ring-surface-card">
                      <svg
                        className="w-3.5 h-3.5 text-surface-card"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-theme-earth bg-surface-card flex items-center justify-center relative z-10 ring-4 ring-surface-card" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`type-body font-bold ${isCompleted ? 'text-notice-primary' : 'text-notice-secondary'}`}
                    >
                      {config.title}
                    </h4>
                  </div>

                  <div
                    className={`type-meta mt-1 mb-2 ${isCompleted ? 'text-notice-secondary' : 'text-notice-muted font-bold'}`}
                  >
                    {statusLabel}
                  </div>
                  <p
                    className={`type-body ${isCompleted ? 'text-notice-secondary' : 'text-notice-muted'}`}
                  >
                    {config.defaultDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
