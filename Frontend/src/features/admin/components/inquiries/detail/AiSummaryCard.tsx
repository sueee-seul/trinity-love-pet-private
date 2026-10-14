import { useState, type ReactElement } from 'react';
import type { InquiryConversation } from '../../../types/inquiry';

interface AiSummaryCardProps {
  inquiry: InquiryConversation;
}

export function AiSummaryCard({ inquiry }: AiSummaryCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <h4 className="type-card-title type-body">AI Summary</h4>
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-notice-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <>
          {/* A hand-over line is shown once, as the reason for escalation below. */}
          {inquiry.aiSummary !== inquiry.aiEscalationReason && (
            <p className="mt-2 type-body text-notice-secondary">{inquiry.aiSummary}</p>
          )}

          <dl className="mt-3 space-y-2">
            <div>
              <dt className="type-eyebrow text-notice-muted">Detected topic</dt>
              <dd className="type-body text-notice-primary">{inquiry.aiDetectedTopic}</dd>
            </div>
            {inquiry.aiEscalationReason && (
              <div>
                <dt className="type-eyebrow text-notice-muted">Reason for escalation</dt>
                <dd className="type-body text-notice-primary">{inquiry.aiEscalationReason}</dd>
              </div>
            )}
            <div>
              <dt className="type-eyebrow text-notice-muted">Relevant information</dt>
              <dd className="type-body text-notice-primary">{inquiry.aiRelevantInfo}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}
