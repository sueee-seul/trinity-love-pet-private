import type { ReactElement } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { usePortalCopy } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';

interface InactivityPromptModalProps {
  isOpen: boolean;
  onContinueWithAi: () => void;
  onContactSupport: () => void;
  onCloseConversation: () => void;
}

export function InactivityPromptModal({
  isOpen,
  onContinueWithAi,
  onContactSupport,
  onCloseConversation,
}: InactivityPromptModalProps): ReactElement | null {
  const copy = usePortalCopy(CHAT_COPY);
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen}>
      {/*
       * The dialog is drawn on `body`, outside the portal's `parent-type-scale`, so it names the
       * customer type scale again to keep the portal's sizes.
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inactivity-prompt-title"
        className="parent-type-scale p-6 sm:p-8"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-status-warning/10 text-accent-foreground"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2
          id="inactivity-prompt-title"
          className="type-card-title m-0 mt-4 text-center font-normal"
        >
          {copy.inactivityTitle}
        </h2>
        <p className="type-meta m-0 mt-1 text-center">{copy.inactivityIdleFor}</p>
        <p className="type-body m-0 mt-3 text-center text-notice-secondary">
          {copy.inactivityBody}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onContinueWithAi}
            className="type-button min-h-11 rounded-full border border-control-border px-4 py-2.5 text-notice-secondary transition-colors hover:bg-surface-cream"
          >
            {copy.continueWithAi}
          </button>
          <button
            type="button"
            onClick={onContactSupport}
            className="type-button min-h-11 rounded-full bg-action-dark theme-gradient-action px-4 py-2.5 text-on-action-dark transition-colors hover:bg-action-dark-hover"
          >
            {copy.contactSupport}
          </button>
        </div>
        <button
          type="button"
          onClick={onCloseConversation}
          className="type-button mt-3 min-h-11 w-full rounded-full bg-surface-deep px-4 py-2.5 text-notice-secondary transition-colors hover:bg-surface-bubbles"
        >
          {copy.closeNoLongerNeeded}
        </button>

        <p className="type-meta m-0 mt-4 text-center">{copy.closingNote}</p>
      </div>
    </Modal>
  );
}
