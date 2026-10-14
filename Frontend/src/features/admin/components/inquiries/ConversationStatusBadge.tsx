import type { ReactElement } from 'react';
import type { ConversationStatus } from '../../types/inquiry';

const STYLES: Record<ConversationStatus, string> = {
  Active: 'bg-status-success/10 text-status-success',
  Closed: 'bg-surface-deep text-notice-muted',
};

export function ConversationStatusBadge({ status }: { status: ConversationStatus }): ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 type-meta font-bold ${STYLES[status]}`}
    >
      {status === 'Active' && <span className="h-1.5 w-1.5 rounded-full bg-status-success" />}
      {status}
    </span>
  );
}
