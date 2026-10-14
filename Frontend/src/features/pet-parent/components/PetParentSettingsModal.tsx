import React from 'react';
import { Modal } from '../../../shared/components/ui/Modal';
import { AccessibilitySettingsToggle, AppearanceSettings } from '../../../shared/accessibility';
import { usePortalCopy } from '../i18n/portalLocale';
import { ACCOUNT_SETTINGS_COPY } from './accountSettingsCopy';

interface PetParentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PetParentSettingsModal: React.FC<PetParentSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const copy = usePortalCopy(ACCOUNT_SETTINGS_COPY);
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/*
       * Capped and scrollable. The appearance controls are taller than a laptop viewport, and the
       * shared Modal clips whatever overflows its box, so the reading colours and the launcher
       * toggle were simply unreachable, with nothing on screen to suggest more was below.
       *
       * The cap lives here rather than in the shared Modal, which several other dialogs use and
       * which should not start scrolling on their behalf.
       *
       * The Modal draws on `body`, outside the portal's `parent-type-scale`, so the dialog names the
       * customer type scale again.
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        className="parent-type-scale flex max-h-[85dvh] flex-col p-6 sm:p-8"
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <h2 id="account-settings-title" className="type-card-title m-0 font-normal">
            {copy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-notice-muted transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* `-mx-1 px-1` keeps focus rings on the controls from being clipped by the scroll box. */}
        <div
          aria-label={copy.contentArea}
          className="-mx-1 mt-6 flex-1 space-y-4 overflow-y-auto px-1"
        >
          <AppearanceSettings />
          <AccessibilitySettingsToggle />
        </div>
      </div>
    </Modal>
  );
};
