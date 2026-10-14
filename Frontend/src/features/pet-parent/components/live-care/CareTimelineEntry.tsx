import type { KeyboardEvent, ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { CareEntry } from '../../types/liveCare';
import {
  BUBBLE_STYLES,
  TIMELINE_CARD,
  TIMELINE_CARD_INTERACTIVE,
  TIMELINE_CHIP,
} from './liveCareDefaults';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { LiveCareIcon } from './LiveCareIcons';
import { STATUS_PILL, STATUS_TONE } from '../home/homeStyles';

interface CareTimelineEntryProps {
  entry: CareEntry;
  /** Whether this is the last entry. Controls the connector line below it. */
  isLast: boolean;
  onOpenPhotos: (entryId: string) => void;
}

function EntryStatus({ status }: { status: CareEntry['status'] }): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).timeline;
  if (status === 'completed') {
    return (
      <span className={`${STATUS_PILL} gap-1 ${STATUS_TONE.success}`}>
        <LiveCareIcon name="check" className="h-3.5 w-3.5" />
        {copy.completed}
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className={`${STATUS_PILL} gap-1 ${STATUS_TONE.attention}`}>
        <LiveCareIcon name="clock" className="h-3.5 w-3.5" />
        {copy.inProgress}
      </span>
    );
  }
  return (
    <span className={`${STATUS_PILL} gap-1 bg-surface-deep text-notice-secondary`}>
      <LiveCareIcon name="clock" className="h-3.5 w-3.5" />
      {copy.upcoming}
    </span>
  );
}

/** A single timeline row. Only clickable (and keyboard-focusable) when the
 * entry has actual photo URLs attached, not just a `photoCount`. */
export function CareTimelineEntry({
  entry,
  isLast,
  onOpenPhotos,
}: CareTimelineEntryProps): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY);
  const locale = usePortalLocale();
  // Staff write notes in English; a Chinese reader gets the translation, labelled, with the
  // original one tap away below the card (the card itself is a button, so it cannot hold one).
  const noteInChinese = locale === 'zh' && entry.detail ? (entry.detailInChinese ?? null) : null;
  const hidesOriginal = locale === 'zh' && Boolean(entry.detail);
  const hasPhotos = Boolean(entry.photos && entry.photos.length > 0);
  const photoCount = entry.photos?.length ?? entry.photoCount ?? 0;
  // Booleans, not the raw values: `{0 && ...}` would print a stray "0" into the card.
  const showMood = Boolean(entry.mood);
  const showPhotoCount = photoCount > 0;
  // Upcoming entries are marked by a dashed edge rather than faded, so their text keeps its contrast.
  const edge =
    entry.status === 'upcoming'
      ? 'border-dashed border-border-soft'
      : 'border-border-soft shadow-card';

  const openOnKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenPhotos(entry.id);
    }
  };

  return (
    <li className="flex gap-3">
      <div className="flex w-10 shrink-0 flex-col items-center">
        {/* The icon repeats the entry title, so it is hidden from screen readers. */}
        <div
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-soft text-card-title ${BUBBLE_STYLES[entry.category]}`}
        >
          {entry.icon}
        </div>
        {!isLast && <div className="care-timeline-connector" />}
      </div>

      <div className="min-w-0 flex-1">
        <div
          role={hasPhotos ? 'button' : undefined}
          tabIndex={hasPhotos ? 0 : undefined}
          aria-haspopup={hasPhotos ? 'dialog' : undefined}
          aria-label={hasPhotos ? copy.timeline.viewPhotosFrom(entry.title) : undefined}
          onClick={hasPhotos ? (): void => onOpenPhotos(entry.id) : undefined}
          onKeyDown={hasPhotos ? openOnKey : undefined}
          className={`${TIMELINE_CARD} ${edge} ${hasPhotos ? TIMELINE_CARD_INTERACTIVE : ''}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="type-eyebrow m-0 tracking-wider text-notice-muted">
                {entry.time ?? copy.timeline.timeNotSet}
              </p>
              <p className="type-body m-0 mt-1 font-bold">{entry.title}</p>
            </div>
            <EntryStatus status={entry.status} />
          </div>

          {entry.detail && !hidesOriginal && (
            <p className="type-meta m-0 mt-1.5 text-notice-secondary">{entry.detail}</p>
          )}
          {hidesOriginal && (
            <p className="type-meta m-0 mt-1.5 text-notice-secondary">
              {noteInChinese ?? copy.timeline.noteNotTranslated}
              {noteInChinese && (
                <span className={`${TIMELINE_CHIP} ml-2`}>{copy.timeline.noteTranslated}</span>
              )}
            </p>
          )}

          {(showMood || showPhotoCount) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {showMood && <span className={TIMELINE_CHIP}>{entry.mood}</span>}
              {showPhotoCount && (
                <span className={TIMELINE_CHIP}>
                  <LiveCareIcon name="camera" />
                  {copy.photos.count(photoCount)}
                </span>
              )}
              {hasPhotos && (
                <span className="type-button inline-flex items-center gap-1 text-accent-foreground">
                  {copy.timeline.viewPhotos}
                  <LiveCareIcon name="chevron" />
                </span>
              )}
            </div>
          )}
        </div>
        {hidesOriginal && (
          <details className="-mt-1 mb-3 px-1">
            <summary className="type-meta cursor-pointer text-accent-foreground">
              {copy.timeline.showNoteOriginal}
            </summary>
            <p lang="en-NZ" className="type-meta m-0 mt-1 text-notice-secondary">
              {entry.detail}
            </p>
          </details>
        )}
      </div>
    </li>
  );
}
