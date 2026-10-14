import { type ReactElement } from 'react';
import { PhotoCarousel } from '../../../../shared/components/ui/PhotoCarousel';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { DayPhoto } from '../../types/liveCare';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { PhotoDialogHeader } from './PhotoDialogHeader';

interface DayPhotoCarouselProps {
  photos: DayPhoto[];
  onClose: () => void;
}

/** Auto-advancing slideshow for the "Photos of the day" card. Rendered through the shared Modal
 * for the same reason as PhotoLightbox: a fixed overlay inside the blurred content panel would be
 * trapped under the sticky navbar. */
export function DayPhotoCarousel({ photos, onClose }: DayPhotoCarouselProps): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).photos;
  return (
    <Modal isOpen onClose={onClose}>
      {/* Modal renders outside the portal's `parent-type-scale` wrapper, so it brings its own. */}
      <div className="parent-type-scale">
        {/* The shared Modal has no height limit, so the dialog scrolls itself: on a short screen
            the 4:3 photo would otherwise push the close button out of reach. */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.ofTheDay}
          className="max-h-[85dvh] overflow-y-auto p-4 sm:p-5"
        >
          <PhotoCarousel
            photos={photos}
            ariaLabel={copy.ofTheDayCarousel}
            onClose={onClose}
            autoplay
            autoFocus
            renderHeader={(_, currentIndex) => {
              const current = photos[currentIndex] ?? photos[0];
              if (!current) {
                return null;
              }

              return (
                <PhotoDialogHeader
                  time={current.entryTime}
                  title={current.entryTitle}
                  onClose={onClose}
                />
              );
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
