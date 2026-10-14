import { type ReactElement } from 'react';
import { PortalIllustration as Illustration } from '../illustrations/PortalIllustration';
import { usePortalLocale } from '../../i18n/portalLocale';
import type { GetReadyStay } from '../../types/getReady';
import { possessive } from '../../utils/home';
import { GetReadyTaskList } from '../get-ready/GetReadyTaskList';
import { getReadyProgress, hasOpenTasks } from '../get-ready/getReadyTasks';
import { formatDateTime } from '../stays/formatStayDate';
import { HOME_COPY } from './homeCopy';
import { INNER_PANEL, SECTION_TITLE, STATUS_PILL, STATUS_TONE } from './homeStyles';

function GetReadyCard({ stay }: { stay: GetReadyStay }): ReactElement {
  const locale = usePortalLocale();
  const copy = HOME_COPY[locale];
  const titleId = `get-ready-${stay.bookingPetId}-title`;
  const tone = hasOpenTasks(stay.tasks) ? STATUS_TONE.attention : STATUS_TONE.success;
  return (
    <section aria-labelledby={titleId} className={INNER_PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className={`${STATUS_PILL} ${tone}`}>{getReadyProgress(stay.tasks, locale)}</span>
        <span className="type-meta font-bold text-accent-foreground">
          {copy.dropOffAt(formatDateTime(stay.dropOffAt, locale))}
        </span>
      </div>
      <h2 id={titleId} className={`${SECTION_TITLE} m-0 mt-4`}>
        {copy.getReadyTitle(possessive([stay.petName], locale))}
      </h2>
      <div className="mt-4">
        <Illustration name="get-ready" className="mb-4 max-w-sm" />
        <GetReadyTaskList tasks={stay.tasks} target={stay} />
      </div>
    </section>
  );
}

/**
 * One card for each approved pet whose drop-off is at most 48 hours away. The server works the
 * window out when Home is read, so the card appears without any job running; nothing is sent to
 * the bell for it.
 */
export function GetReadyCards({ stays }: { stays: GetReadyStay[] }): ReactElement {
  return (
    <>
      {stays.map((stay) => (
        <GetReadyCard key={stay.bookingPetId} stay={stay} />
      ))}
    </>
  );
}
