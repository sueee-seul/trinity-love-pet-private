import { useEffect, useRef, type ReactElement } from 'react';
import type { CareEntry } from '../../types/liveCare';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { usePortalCopy } from '../../i18n/portalLocale';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { PhotoDialogHeader } from './PhotoDialogHeader';

interface PhotoLightboxProps {
  entry: CareEntry;
  onClose: () => void;
}

/** Lightbox shown when a timeline card with photos is clicked. It goes through the shared Modal,
 * which renders into <body>: the portal's content panel has a backdrop blur, and a fixed overlay
 * inside it would sit under the sticky navbar. */
export function PhotoLightbox({ entry, onClose }: PhotoLightboxProps): ReactElement {
  const photos = entry.photos ?? [];
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { photos: copy, timeline } = usePortalCopy(LIVE_CARE_COPY);

  useEffect((): (() => void) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Move focus into the dialog, so a keyboard user lands on its close button.
  useEffect((): void => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <Modal isOpen onClose={onClose}>
      {/* Modal renders outside the portal's `parent-type-scale` wrapper, so it brings its own. */}
      <div className="parent-type-scale">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.photosFrom(entry.title)}
          className="max-h-[85dvh] overflow-y-auto p-4 sm:p-5"
        >
          <PhotoDialogHeader
            time={entry.time ?? timeline.timeNotSet}
            title={entry.title}
            onClose={onClose}
            closeButtonRef={closeButtonRef}
          />

          <div className={`grid gap-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {photos.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={copy.photoAlt(entry.title, i + 1)}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>

          {entry.mood && <p className="type-meta m-0 mt-3 text-notice-secondary">{entry.mood}</p>}
        </div>
      </div>
    </Modal>
  );
}
