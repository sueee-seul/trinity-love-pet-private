import { useState, type ReactElement } from 'react';
import { Select } from '../../../../../shared/components/ui/Select';
import type { InquiryAssignee } from '../../../types/inquiry';

interface DetailFooterActionsProps {
  isManager: boolean;
  isClosed: boolean;
  assignee: InquiryAssignee | null;
  assigneeOptions: InquiryAssignee[];
  onAssigneeChange: (assignee: InquiryAssignee | null) => void;
  onCloseConversation: () => void;
}

export function DetailFooterActions({
  isManager,
  isClosed,
  assignee,
  assigneeOptions,
  onAssigneeChange,
  onCloseConversation,
}: DetailFooterActionsProps): ReactElement {
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText.trim().toLowerCase() === 'confirm';

  const cancelClose = (): void => {
    setIsConfirmingClose(false);
    setConfirmText('');
  };

  return (
    <div className="space-y-2 border-t border-border-soft p-4">
      {isManager && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAssignOpen((value) => !value)}
            className="w-full rounded-full border border-control-border px-3 py-2 type-button text-notice-secondary transition-colors hover:bg-surface-cream"
          >
            {assignee ? 'Reassign' : 'Assign'}
          </button>
          {isAssignOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-full">
              <Select
                aria-label="Choose assignee"
                value={assignee?.id ?? 'Unassigned'}
                onChange={(value) => {
                  const next = assigneeOptions.find((option) => option.id === value) ?? null;
                  onAssigneeChange(next);
                  setIsAssignOpen(false);
                }}
                options={[
                  { value: 'Unassigned', label: 'Unassigned' },
                  ...assigneeOptions.map((option) => ({ value: option.id, label: option.name })),
                ]}
              />
            </div>
          )}
        </div>
      )}

      {!isClosed &&
        (isConfirmingClose ? (
          <div className="rounded-lg border border-status-danger/40 bg-status-danger/5 p-3">
            <label
              className="block type-meta text-notice-secondary"
              htmlFor="close-conversation-confirm"
            >
              Type <span className="font-bold text-status-danger">confirm</span> to close this
              conversation.
            </label>
            <input
              id="close-conversation-confirm"
              type="text"
              autoFocus
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && isConfirmed) {
                  onCloseConversation();
                  cancelClose();
                } else if (event.key === 'Escape') {
                  cancelClose();
                }
              }}
              placeholder="confirm"
              className="mt-2 w-full rounded-lg border border-field-border bg-surface-card px-3 py-1.5 type-body text-notice-primary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={cancelClose}
                className="flex-1 rounded-full border border-control-border px-3 py-1.5 type-button text-notice-secondary transition-colors hover:bg-surface-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isConfirmed}
                onClick={() => {
                  onCloseConversation();
                  cancelClose();
                }}
                className="flex-1 rounded-full bg-status-danger px-3 py-1.5 type-button text-surface-card transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Close Conversation
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingClose(true)}
            className="w-full rounded-full bg-status-danger px-3 py-2.5 type-button text-surface-card transition-colors hover:opacity-90"
          >
            Close Conversation
          </button>
        ))}
    </div>
  );
}
