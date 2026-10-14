import { useState, type ReactElement } from 'react';
import type { InquiryConversation } from '../../../types/inquiry';
import { formatInquiryDayLabel, formatInquiryTime } from '../../../utils/inquiryTime';

interface ConversationInfoCardProps {
  inquiry: InquiryConversation;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex w-[132px] flex-shrink-0 items-center gap-2 type-meta text-notice-muted">
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {label}
      </div>
      <div className="min-w-0 flex-1 type-body text-notice-primary">{value}</div>
    </div>
  );
}

export function ConversationInfoCard({ inquiry }: ConversationInfoCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2"
      >
        <h4 className="type-card-title type-body">Conversation Information</h4>
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
        <div className="mt-2">
          <InfoRow
            icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            label="Pet Parent"
            value={inquiry.parentName}
          />
          <InfoRow
            icon="M12 3c-3 3-5 5.5-5 8.5A5 5 0 0012 17a5 5 0 005-5.5C17 8.5 15 6 12 3z"
            label="Pet"
            value={inquiry.petName ?? 'None'}
          />
          <InfoRow
            icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            label="Topic"
            value={inquiry.topic}
          />
          <InfoRow
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            label="Started"
            value={`${formatInquiryDayLabel(inquiry.startedAt)}, ${formatInquiryTime(inquiry.startedAt)}`}
          />
          <InfoRow
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            label="Duration"
            value={`${inquiry.durationMinutes}m`}
          />
          {inquiry.supportRequestedAt && (
            <InfoRow
              icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              label="Support Requested"
              value={formatInquiryTime(inquiry.supportRequestedAt)}
            />
          )}
          <InfoRow
            icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            label="Assignee"
            value={inquiry.assignee?.name ?? 'Unassigned'}
          />
        </div>
      )}
    </div>
  );
}
