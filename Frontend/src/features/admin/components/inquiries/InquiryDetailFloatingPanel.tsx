import { useMemo, type ReactElement } from 'react';
import { useStaffDirectory } from '../../hooks/useStaffDirectory';
import { useInquiryLiveUpdates } from '../../hooks/useInquiryLiveUpdates';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { useInquiryStore } from '../../store/inquiryStore';
import type { InquiryAssignee, InquiryConversation } from '../../types/inquiry';
import { ConversationDetailPanel } from './detail/ConversationDetailPanel';

function MinimizedBar({
  inquiry,
  onExpand,
  onClose,
}: {
  inquiry: InquiryConversation;
  onExpand: () => void;
  onClose: () => void;
}): ReactElement {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[300px] items-center gap-2 rounded-2xl border border-border-soft bg-surface-card p-3 shadow-card">
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={`Expand conversation with ${inquiry.parentName}`}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-foreground type-meta font-bold text-surface-card">
          {inquiry.parentInitials}
        </span>
        <span className="min-w-0 flex-1">
          <p className="truncate type-body font-bold text-notice-primary">{inquiry.parentName}</p>
          <p className="truncate type-meta text-notice-muted">{inquiry.topic}</p>
        </span>
      </button>
      <button
        type="button"
        aria-label="Expand panel"
        onClick={onExpand}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-notice-muted transition-colors hover:bg-surface-cream"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-notice-muted transition-colors hover:bg-surface-cream"
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
  );
}

/**
 * Mounted once at the admin portal level so the conversation stays open (or minimised) while an
 * employee navigates between admin pages, instead of closing whenever they leave Inquiries.
 */
export function InquiryDetailFloatingPanel(): ReactElement | null {
  const openConversationUuid = useInquiryStore((state) => state.openConversationUuid);
  const isPanelMinimized = useInquiryStore((state) => state.isPanelMinimized);
  const inquiryByUuid = useInquiryStore((state) => state.inquiryByUuid);
  const minimizePanel = useInquiryStore((state) => state.minimizePanel);
  const expandPanel = useInquiryStore((state) => state.expandPanel);
  const closeConversationPanel = useInquiryStore((state) => state.closeConversationPanel);
  const setAssignee = useInquiryStore((state) => state.setAssignee);
  const setNote = useInquiryStore((state) => state.setNote);
  const appendReply = useInquiryStore((state) => state.appendReply);
  const closeConversation = useInquiryStore((state) => state.closeConversation);

  useInquiryLiveUpdates();

  const { staff: staffDirectory } = useStaffDirectory();
  const currentStaff = useCurrentStaffStore((state) => state.staff);
  const isManager = currentStaff?.employee_role === 'manager';

  const assigneeOptions = useMemo<InquiryAssignee[]>(
    () => staffDirectory.map((member) => ({ id: member.id, name: member.name })),
    [staffDirectory],
  );

  const inquiry = openConversationUuid ? (inquiryByUuid[openConversationUuid] ?? null) : null;

  if (!inquiry) {
    return null;
  }

  if (isPanelMinimized) {
    return (
      <MinimizedBar inquiry={inquiry} onExpand={expandPanel} onClose={closeConversationPanel} />
    );
  }

  return (
    <div className="fixed bottom-4 right-4 top-20 z-50 flex w-[404px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card">
      <ConversationDetailPanel
        key={inquiry.uuid}
        inquiry={inquiry}
        isManager={isManager}
        assigneeOptions={assigneeOptions}
        onClose={closeConversationPanel}
        onMinimize={minimizePanel}
        onAssigneeChange={(assignee) => setAssignee(inquiry.uuid, assignee)}
        onSaveNotes={(notes) => setNote(inquiry.uuid, notes)}
        onSendReply={(body) =>
          appendReply(
            inquiry.uuid,
            body,
            currentStaff?.name ?? 'Customer Support',
            currentStaff?.employee_role,
          )
        }
        onCloseConversation={() => closeConversation(inquiry.uuid)}
      />
    </div>
  );
}
