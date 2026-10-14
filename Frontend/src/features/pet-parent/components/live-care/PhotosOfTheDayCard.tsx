import type { KeyboardEvent, ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { DayPhoto } from '../../types/liveCare';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { TIMELINE_CARD, TIMELINE_CARD_INTERACTIVE } from './liveCareDefaults';
import { LiveCareIcon } from './LiveCareIcons';
import { STATUS_PILL } from '../home/homeStyles';

interface PhotosOfTheDayCardProps {
  dayPhotos: DayPhoto[];
  /** Whether more timeline entries follow below this card. Controls the
   * connector line, matching the connector on regular entries. */
  showConnector: boolean;
  onOpen: () => void;
}

/** One-time card at the top of the timeline summarizing all photos taken
 * that day. Clicking it opens the DayPhotoCarousel. */
export function PhotosOfTheDayCard({
  dayPhotos,
  showConnector,
  onOpen,
}: PhotosOfTheDayCardProps): ReactElement {
  const [firstPhoto] = dayPhotos;
  const copy = usePortalCopy(LIVE_CARE_COPY).photos;
  const countLabel = copy.count(dayPhotos.length);

  const openOnKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li className="flex gap-3">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-bubbles text-accent-foreground"
        >
          <LiveCareIcon name="camera" className="h-5 w-5" />
        </div>
        {showConnector && <div className="care-timeline-connector" />}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={copy.viewAllFromDay(countLabel)}
        onClick={onOpen}
        onKeyDown={openOnKey}
        className={`${TIMELINE_CARD} border-border-soft shadow-card ${TIMELINE_CARD_INTERACTIVE}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="type-eyebrow m-0 tracking-wider text-notice-muted">{copy.allDay}</p>
            <p className="type-body m-0 mt-1 font-bold">{copy.ofTheDay}</p>
          </div>
          {/* The Approved badge's pair: accent text on the bubbles tint falls just under 4.5:1. */}
          <span className={`${STATUS_PILL} gap-1 bg-accent-foreground/10 text-accent-foreground`}>
            <LiveCareIcon name="photos" className="h-3.5 w-3.5" />
            {countLabel}
          </span>
        </div>

        {firstPhoto && (
          <div className="relative mt-3">
            <img
              src={firstPhoto.src}
              alt={copy.dayPreviewAlt(firstPhoto.alt)}
              className="h-40 w-full rounded-xl object-cover sm:h-80"
              loading="lazy"
              decoding="async"
            />
            {/* Ink on its own inverse, so the label stays legible on any photo in any theme. */}
            <span className="type-meta absolute bottom-2 right-2 rounded-full bg-notice-primary/85 px-3 py-1 font-bold text-surface-card">
              {copy.viewAll}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
