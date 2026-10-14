import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy } from '../../i18n/portalLocale';
import { aucklandIsoDate } from '../live-care/liveCareDates';
import { LIVE_CARE_COPY } from '../live-care/liveCareCopy';
import { useStaySummaries } from '../live-care/useStaySummaries';
import { firstSentence } from './firstSentence';

/**
 * One line on the homepage's stay hero: the first sentence of today's update and a link to the
 * whole of it on Live care. Nothing shows until today's update exists, and nothing shows when the
 * updates cannot be loaded, since the hero's own link to Live care is still there.
 */
export function TodaysUpdateLine({
  bookingPetId,
  to,
}: {
  bookingPetId: string;
  /** The Live care page for this stay. */
  to: string;
}): ReactElement | null {
  const copy = usePortalCopy(LIVE_CARE_COPY).updates;
  const { summaries } = useStaySummaries(bookingPetId);
  const today = aucklandIsoDate(new Date());
  const update =
    summaries?.find((summary) => summary.kind === 'daily' && summary.date === today) ?? null;

  if (update === null) return null;

  return (
    <p className="type-meta m-0 mt-4 text-notice-primary">
      {copy.homeLine(firstSentence(update.body))}{' '}
      <Link to={to} className="font-bold text-accent-foreground underline">
        {copy.readMore}
      </Link>
    </p>
  );
}
