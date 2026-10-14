import type { ReactElement } from 'react';
import type { SupportStatus } from '../../types/inquiry';

const STYLES: Record<SupportStatus, string> = {
  'AI Handling': 'bg-surface-deep text-notice-muted',
  'Support Requested': 'bg-status-warning/10 text-accent-foreground',
  'Support Assigned': 'bg-theme-apricot/40 text-accent-foreground',
  'Support Handling': 'bg-status-success/10 text-status-success',
  Resolved: 'bg-action-dark/10 text-action-dark',
};

interface SupportStatusBadgeProps {
  status: SupportStatus;
  requestedAt?: string | null;
  requestedAtLabel?: string;
}

export function SupportStatusBadge({
  status,
  requestedAt,
  requestedAtLabel,
}: SupportStatusBadgeProps): ReactElement {
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 type-meta font-bold ${STYLES[status]}`}
      >
        {status}
      </span>
      {requestedAt && requestedAtLabel && (
        <span className="type-meta text-notice-muted">{requestedAtLabel}</span>
      )}
    </div>
  );
}
