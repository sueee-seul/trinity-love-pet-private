import { PortalIllustration as Illustration } from '../illustrations/PortalIllustration';
import { useState, type ReactElement } from 'react';
import type { DayPhoto, LiveCareData } from '../../types/liveCare';
import { usePortalCopy } from '../../i18n/portalLocale';
import { SECTION_TITLE } from '../home/homeStyles';
import { CareTimelineEntry } from './CareTimelineEntry';
import { DayPhotoCarousel } from './DayPhotoCarousel';
import { DaySelector } from './DaySelector';
import { DaySummaryCard } from './DaySummaryCard';
import { LIVE_CARE_COPY, type LiveCareCopy } from './liveCareCopy';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotosOfTheDayCard } from './PhotosOfTheDayCard';
import { StayUpdateCard } from './StayUpdateCard';

interface CareDaySectionProps {
  data: LiveCareData;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

// Every photo of the day in timeline order, tagged with the activity it came from so the
// slideshow can caption it.
function collectDayPhotos(entries: LiveCareData['entries'], copy: LiveCareCopy): DayPhoto[] {
  return entries.flatMap((entry) =>
    (entry.photos ?? []).map((src, i) => ({
      src,
      alt: copy.photos.photoAlt(entry.title, i + 1),
      entryTitle: entry.title,
      entryTime: entry.time ?? copy.timeline.timeNotSet,
    })),
  );
}

/** The chosen day of the stay: the day strip first, because the summary and the timeline below
 * both describe whichever day is picked there. */
export function CareDaySection({
  data,
  selectedDate,
  onSelectDate,
}: CareDaySectionProps): ReactElement {
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [dayPhotosOpen, setDayPhotosOpen] = useState(false);
  const copy = usePortalCopy(LIVE_CARE_COPY);

  const { entries } = data;
  const openEntry = entries.find((entry) => entry.id === openEntryId) ?? null;
  const dayPhotos = collectDayPhotos(entries, copy);

  return (
    <section aria-labelledby="care-day-title" className="flex flex-col gap-4">
      <h2 id="care-day-title" className={SECTION_TITLE}>
        {copy.day.title}
      </h2>
      <DaySelector
        availableDates={data.availableDates}
        selectedDate={selectedDate}
        onSelect={onSelectDate}
      />

      {/* The stay report and the day's update first: they are what the parent was told, in
          sentences, and the timeline below is the record behind them. */}
      <StayUpdateCard bookingPetId={data.bookingPetId} date={selectedDate} careDay={data} />

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-soft p-6 text-center">
          <Illustration
            name="empty-care"
            className="mx-auto mb-4 max-w-xs"
            imageClassName="aspect-[4/3] w-full rounded-2xl object-contain"
          />
          <p className="type-meta m-0">{copy.day.noActivities}</p>
        </div>
      ) : (
        <>
          <DaySummaryCard entries={entries} stats={data.stats} />
          <ul className="m-0 list-none p-0">
            {dayPhotos.length > 0 && (
              <PhotosOfTheDayCard
                dayPhotos={dayPhotos}
                showConnector
                onOpen={(): void => setDayPhotosOpen(true)}
              />
            )}
            {entries.map((entry, i) => (
              <CareTimelineEntry
                key={entry.id}
                entry={entry}
                isLast={i === entries.length - 1}
                onOpenPhotos={setOpenEntryId}
              />
            ))}
          </ul>
        </>
      )}

      {openEntry && <PhotoLightbox entry={openEntry} onClose={(): void => setOpenEntryId(null)} />}
      {dayPhotosOpen && dayPhotos.length > 0 && (
        <DayPhotoCarousel photos={dayPhotos} onClose={(): void => setDayPhotosOpen(false)} />
      )}
    </section>
  );
}
