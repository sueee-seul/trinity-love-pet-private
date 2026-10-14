import type { ReactElement } from 'react';
import { MANAGER_REVIEW_LABELS, type ManagerReviewStatus } from '../../types/booking';

const STYLES: Record<ManagerReviewStatus, string> = {
  pending: 'bg-status-warning-soft text-accent-foreground',
  approved: 'bg-status-success-soft text-status-success',
  refused: 'bg-status-danger-soft text-status-danger',
  cancelled: 'bg-surface-cream text-notice-secondary',
};

export function BookingStatusBadge({ status }: { status: ManagerReviewStatus }): ReactElement {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 type-meta font-bold ${STYLES[status]}`}
    >
      {MANAGER_REVIEW_LABELS[status]}
    </span>
  );
}
