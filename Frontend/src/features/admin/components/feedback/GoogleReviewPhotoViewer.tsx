import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  PhotoCarousel,
  type PhotoCarouselPhoto,
} from '../../../../shared/components/ui/PhotoCarousel';
import { toBackendAssetUrl } from '../../../maps-review/utils/reviewMedia';

interface GoogleReviewPhotoViewerProps {
  /** App-owned review id used to keep the viewer and its labels unique. */
  reviewId: string;
  /** Reviewer name used in the trigger and dialog labels. */
  reviewerName: string;
  /** Review photo URLs returned by the employee Google Review projection. */
  photoUrls: string[];
}

interface PanelPosition {
  top: number;
  left: number;
}

const PHOTO_VIEWER_WIDTH = 560;
const VIEWPORT_GUTTER = 16;
const PANEL_OFFSET = 8;
const DEFAULT_PANEL_HEIGHT = 500;

/**
 * Renders a trigger-anchored Google Review photo carousel for the Card and Table views.
 *
 * @remarks
 * The viewer is a modeless dialog so an already-open reply composer remains visible and editable. It
 * owns photo placement state while the shared carousel owns the current photo and navigation.
 */
export const GoogleReviewPhotoViewer: React.FC<GoogleReviewPhotoViewerProps> = ({
  reviewId,
  reviewerName,
  photoUrls,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const updatePanelPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(
      PHOTO_VIEWER_WIDTH,
      Math.max(0, window.innerWidth - VIEWPORT_GUTTER * 2),
    );
    const measuredHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
    const panelHeight =
      measuredHeight > 0
        ? measuredHeight
        : Math.min(DEFAULT_PANEL_HEIGHT, window.innerHeight - VIEWPORT_GUTTER * 2);
    const maxLeft = Math.max(VIEWPORT_GUTTER, window.innerWidth - panelWidth - VIEWPORT_GUTTER);
    const left = Math.min(Math.max(triggerRect.left, VIEWPORT_GUTTER), maxLeft);
    const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_GUTTER;
    const top =
      spaceBelow >= panelHeight + PANEL_OFFSET
        ? triggerRect.bottom + PANEL_OFFSET
        : Math.max(VIEWPORT_GUTTER, triggerRect.top - panelHeight - PANEL_OFFSET);

    setPanelPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updatePanelPosition();
    const handleViewportChange = (): void => updatePanelPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return (): void => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (photoUrls.length === 0) {
    return null;
  }

  const photos: PhotoCarouselPhoto[] = photoUrls.map((photoUrl, index) => ({
    src: toBackendAssetUrl(photoUrl),
    alt: `${reviewerName}'s review photo ${index + 1}`,
  }));

  const closeViewer = (): void => {
    setIsOpen(false);
    setPanelPosition(null);
    triggerRef.current?.focus();
  };

  const renderHeader = (): ReactNode => (
    <div className="mb-3 flex items-center justify-between gap-4 border-b border-border-soft bg-surface-cream px-4 py-3">
      <h2 id={titleId} className="type-button text-notice-primary">
        Review photos for {reviewerName}
      </h2>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={closeViewer}
        aria-label={`Close review photos for ${reviewerName}`}
        className="rounded-md px-2 py-1 type-button text-notice-secondary transition-colors hover:bg-surface-bubbles focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Close
      </button>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`View image for ${reviewerName}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={`google-review-photo-viewer-${reviewId}`}
        data-testid={`google-review-photo-trigger-${reviewId}`}
        onPointerDown={(event): void => event.stopPropagation()}
        onClick={(event): void => {
          event.stopPropagation();
          setPanelPosition(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-control-border bg-surface-cream px-2 py-1 type-meta text-notice-secondary transition-colors hover:bg-surface-bubbles focus:outline-none focus:ring-2 focus:ring-focus"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a2 2 0 0 1 2-2h2l1 2h6l1-2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"
          />
          <circle cx="12" cy="11" r="3" strokeWidth={2} />
        </svg>
        View image
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[60]">
            <div
              ref={panelRef}
              id={`google-review-photo-viewer-${reviewId}`}
              role="dialog"
              aria-modal="false"
              aria-labelledby={titleId}
              data-testid={`google-review-photo-viewer-${reviewId}`}
              style={{
                top: panelPosition?.top ?? -10000,
                left: panelPosition?.left ?? -10000,
                visibility: panelPosition ? 'visible' : 'hidden',
              }}
              className="pointer-events-auto absolute w-[min(35rem,calc(100vw-2rem))] rounded-2xl border border-control-border bg-surface-card p-4 shadow-xl"
              onPointerDown={(event): void => event.stopPropagation()}
              onClick={(event): void => event.stopPropagation()}
            >
              <PhotoCarousel
                photos={photos}
                ariaLabel={`Review photos for ${reviewerName}`}
                onClose={closeViewer}
                renderHeader={renderHeader}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
