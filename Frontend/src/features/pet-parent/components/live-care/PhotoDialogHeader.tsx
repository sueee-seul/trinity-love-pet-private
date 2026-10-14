import type { ReactElement, Ref } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { LiveCareIcon } from './LiveCareIcons';

interface PhotoDialogHeaderProps {
  time: string;
  title: string;
  onClose: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
}

/** The time, activity and close button above the photos in both photo dialogs. */
export function PhotoDialogHeader({
  time,
  title,
  onClose,
  closeButtonRef,
}: PhotoDialogHeaderProps): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).photos;
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="type-eyebrow m-0 tracking-wider text-notice-muted">{time}</p>
        <p className="type-card-title m-0 mt-1 font-normal">{title}</p>
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label={copy.close}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-card text-notice-secondary transition-colors hover:bg-surface-deep hover:text-notice-primary"
      >
        <LiveCareIcon name="close" className="h-5 w-5" />
      </button>
    </div>
  );
}
