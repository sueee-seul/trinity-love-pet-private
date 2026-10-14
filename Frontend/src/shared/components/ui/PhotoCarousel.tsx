import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSiteCopy, type SiteCopy } from '../../i18n/siteLanguage';

export interface PhotoCarouselPhoto {
  src: string;
  alt: string;
}

interface PhotoCarouselProps {
  /** Photos to display in carousel order. */
  photos: readonly PhotoCarouselPhoto[];
  /** Closes the surrounding viewer. */
  onClose: () => void;
  /** Accessible name for the carousel's image group. */
  ariaLabel: string;
  /** Optional context-specific header rendered above the image. */
  renderHeader?: (photo: PhotoCarouselPhoto, index: number) => ReactNode;
  /** Enables the Live Care auto-advance behavior. */
  autoplay?: boolean;
  /** Delay between automatic photo changes when autoplay is enabled. */
  autoplayIntervalMs?: number;
  /** Delay before autoplay resumes after manual navigation. */
  manualResumeDelayMs?: number;
  /** Focuses the carousel root when it mounts. */
  autoFocus?: boolean;
  /** Optional class names for the shared carousel frame. */
  className?: string;
}

interface PhotoCarouselCopy {
  previous: string;
  next: string;
  /** `photoNumber` counts from 1. */
  goTo: (photoNumber: number) => string;
}

const PHOTO_CAROUSEL_COPY: SiteCopy<PhotoCarouselCopy> = {
  en: {
    previous: 'Previous photo',
    next: 'Next photo',
    goTo: (photoNumber) => `Go to photo ${photoNumber}`,
  },
  zh: {
    previous: '上一张照片',
    next: '下一张照片',
    goTo: (photoNumber) => `查看第 ${photoNumber} 张照片`,
  },
};

const normalizeIndex = (index: number, count: number): number => {
  return ((index % count) + count) % count;
};

/**
 * Shared single-image carousel UI used by Live Care and Google Review viewers.
 *
 * @remarks
 * The component owns only carousel index and optional autoplay state. Each feature owns its
 * surrounding viewer contract, including full-screen versus anchored presentation and modal
 * blocking behavior.
 */
export function PhotoCarousel({
  photos,
  onClose,
  ariaLabel,
  renderHeader,
  autoplay = false,
  autoplayIntervalMs = 3000,
  manualResumeDelayMs = 4000,
  autoFocus = false,
  className = '',
}: PhotoCarouselProps): ReactElement | null {
  const copy = useSiteCopy(PHOTO_CAROUSEL_COPY);
  const [index, setIndex] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(autoplay);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const count = photos.length;
  const currentIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const currentPhoto = photos[currentIndex];

  const goTo = useCallback(
    (nextIndex: number): void => {
      if (count === 0) {
        return;
      }

      setIndex(normalizeIndex(nextIndex, count));
      if (!autoplay) {
        return;
      }

      setIsAutoplaying(false);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      resumeTimeoutRef.current = setTimeout(() => setIsAutoplaying(true), manualResumeDelayMs);
    },
    [autoplay, count, manualResumeDelayMs],
  );

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    carouselRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!isAutoplaying || count <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % count);
    }, autoplayIntervalMs);

    return (): void => clearInterval(timer);
  }, [autoplayIntervalMs, count, isAutoplaying]);

  useEffect(() => {
    return (): void => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (count <= 1) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(currentIndex - 1);
    }
  };

  if (!currentPhoto) {
    return null;
  }

  return (
    <div
      ref={carouselRef}
      tabIndex={-1}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {renderHeader?.(currentPhoto, currentIndex)}

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/5">
        <img
          key={currentPhoto.src}
          src={currentPhoto.src}
          alt={currentPhoto.alt}
          className="h-full w-full object-cover"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              aria-label={copy.previous}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(currentIndex + 1)}
              aria-label={copy.next}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
              {currentIndex + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {photos.map((photo, photoIndex) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => goTo(photoIndex)}
              aria-label={copy.goTo(photoIndex + 1)}
              aria-current={photoIndex === currentIndex}
              className={`h-1.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-focus ${
                photoIndex === currentIndex ? 'w-5 bg-accent-foreground' : 'w-1.5 bg-black/15'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
