import type { ReactElement } from 'react';
import type { InquiryAssignee, InquiryConversation } from '../../../types/inquiry';
import { ConversationStatusBadge } from '../ConversationStatusBadge';
import { SupportStatusBadge } from '../SupportStatusBadge';
import { AiSummaryCard } from './AiSummaryCard';
import { ConversationHistoryCard } from './ConversationHistoryCard';
import { ConversationInfoCard } from './ConversationInfoCard';
import { DetailFooterActions } from './DetailFooterActions';
import { EmployeeNotesCard } from './EmployeeNotesCard';
import { ReplyField } from './ReplyField';

interface ConversationDetailPanelProps {
  inquiry: InquiryConversation;
  isManager: boolean;
  assigneeOptions: InquiryAssignee[];
  onClose: () => void;
  onMinimize: () => void;
  onAssigneeChange: (assignee: InquiryAssignee | null) => void;
  onSaveNotes: (notes: string) => void;
  onSendReply: (body: string) => void;
  onCloseConversation: () => void;
}

export function ConversationDetailPanel({
  inquiry,
  isManager,
  assigneeOptions,
  onClose,
  onMinimize,
  onAssigneeChange,
  onSaveNotes,
  onSendReply,
  onCloseConversation,
}: ConversationDetailPanelProps): ReactElement {
  const isClosed = inquiry.status === 'Closed';
  const parentFirstName = inquiry.parentName.split(' ')[0] ?? inquiry.parentName;

  return (
    <div className="flex h-full w-full flex-col bg-surface-card">
      <div className="flex-shrink-0 border-b border-border-soft p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="type-card-title">Conversation Details</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ConversationStatusBadge status={inquiry.status} />
              <SupportStatusBadge status={inquiry.supportStatus} />
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Minimise panel"
              onClick={onMinimize}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-notice-muted transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-notice-muted transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <ConversationInfoCard inquiry={inquiry} />
        <AiSummaryCard inquiry={inquiry} />
        <EmployeeNotesCard notes={inquiry.notes} onSave={onSaveNotes} />
        <ConversationHistoryCard messages={inquiry.messages} />
      </div>

      {!isClosed && (
        <div className="flex-shrink-0 border-t border-border-soft">
          <ReplyField parentFirstName={parentFirstName} onSend={onSendReply} />
        </div>
      )}

      <div className="flex-shrink-0">
        <DetailFooterActions
          isManager={isManager}
          isClosed={isClosed}
          assignee={inquiry.assignee}
          assigneeOptions={assigneeOptions}
          onAssigneeChange={onAssigneeChange}
          onCloseConversation={onCloseConversation}
        />
      </div>
    </div>
  );
}
