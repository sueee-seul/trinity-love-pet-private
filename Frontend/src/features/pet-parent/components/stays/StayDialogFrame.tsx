import type { ReactElement, ReactNode } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { STAYS_COPY } from './staysCopy';

interface StayDialogFrameProps {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** The dialog My Stays opens to change a stay: its title, a close button and the content. */
export function StayDialogFrame({
  titleId,
  title,
  onClose,
  children,
}: StayDialogFrameProps): ReactElement {
  const copy = usePortalCopy(STAYS_COPY).shared;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="parent-type-scale max-h-[85vh] overflow-y-auto p-6 type-body text-notice-primary"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 id={titleId} className="m-0 type-card-title font-normal text-notice-primary">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="flex-shrink-0 rounded-full p-1 text-notice-muted transition hover:bg-surface-deep hover:text-notice-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}
