import { useEffect, useId, useState, type ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { LiveCareData, StaySummary, SummaryKind } from '../../types/liveCare';
import { SECONDARY_BUTTON } from '../home/homeStyles';
import { aucklandHour, aucklandIsoDate, formatAucklandTime, formatCareDay } from './liveCareDates';
import { useDigestHour } from '../../profile/useDigestHour';
import { LIVE_CARE_COPY } from './liveCareCopy';
import { UpdateMedia } from './UpdateMedia';
import { useStaySummaries } from './useStaySummaries';

const CARD = 'rounded-2xl border border-border-soft bg-surface-card p-4 shadow-card sm:p-5';

/** How long "Copied" stays up after the report's text went to the clipboard. */
const COPIED_NOTICE_MS = 2_500;

function SentAt({ generatedAt }: { generatedAt: string }): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).updates;
  const locale = usePortalLocale();
  return <p className="type-meta m-0">{copy.sentAt(formatAucklandTime(generatedAt, locale))}</p>;
}

/**
 * The report sent on pick-up day. Share hands the text to the device's share sheet where there is
 * one, else copies it, so the parent can give it to their vet.
 */
function StayReportCard({
  report,
  petName,
}: {
  report: StaySummary;
  petName: string;
}): ReactElement {
  const headingId = useId();
  const copy = usePortalCopy(LIVE_CARE_COPY).updates;
  const [copied, setCopied] = useState(false);

  useEffect((): (() => void) | undefined => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_NOTICE_MS);
    return (): void => clearTimeout(timer);
  }, [copied]);

  const share = async (): Promise<void> => {
    const text = `${copy.reportTitle}\n\n${report.body}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: copy.reportTitle, text });
      } catch {
        // The parent closed the share sheet; nothing to say.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // The clipboard refused (an insecure page, or no permission); the text stays on screen.
    }
  };

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h3 id={headingId} className="type-body m-0 font-bold">
        {copy.reportTitle}
      </h3>
      <p className="type-body m-0 mt-2">{report.body}</p>
      {report.media !== null && <UpdateMedia media={report.media} petName={petName} />}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SentAt generatedAt={report.generatedAt} />
        <button
          type="button"
          onClick={(): void => void share()}
          className={`${SECONDARY_BUTTON} sm:min-w-0`}
        >
          {copy.share}
        </button>
        <span role="status" className="type-meta text-status-success">
          {copied ? copy.copied : ''}
        </span>
      </div>
    </section>
  );
}

/**
 * One update under its title: the sentences, the photo or short video when there is one, and when
 * it was sent.
 * The arrival note and the day's update share this layout.
 */
function SummaryCard({
  title,
  summary,
  petName,
}: {
  title: string;
  summary: StaySummary;
  petName: string;
}): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h3 id={headingId} className="type-body m-0 font-bold">
        {title}
      </h3>
      <p className="type-body m-0 mt-2">{summary.body}</p>
      {summary.media !== null && <UpdateMedia media={summary.media} petName={petName} />}
      <div className="mt-3">
        <SentAt generatedAt={summary.generatedAt} />
      </div>
    </section>
  );
}

/**
 * The updates the stay sent its parent, for the day picked in the day strip: the stay report
 * (pick-up day) whichever day is picked, then the day's arrival note (drop-off day), then the
 * day's own update. Before the update hour on the current day it says when the update comes, under
 * the arrival note when there is one; a past day with no update shows nothing. Renders nothing
 * while the first answer is on its way, so a stay with no updates never shows a card that then
 * disappears.
 */
export function StayUpdateCard({
  bookingPetId,
  date,
  careDay,
}: {
  bookingPetId: string;
  /** The day picked in the day strip, 'YYYY-MM-DD'. */
  date: string;
  /** The day's care as the page holds it; a fresh answer re-reads the updates. */
  careDay: LiveCareData;
}): ReactElement | null {
  const copy = usePortalCopy(LIVE_CARE_COPY);
  const locale = usePortalLocale();
  const { summaries, error, retry } = useStaySummaries(bookingPetId, careDay);
  // The parent's own update hour from My account (docs/daily-updates.md); the default until known.
  const digestHour = useDigestHour();

  if (error !== null) {
    return (
      <div className={`${CARD} flex flex-col items-start gap-3`}>
        <p role="alert" className="type-body m-0 font-bold text-status-danger">
          {error.message ?? copy.updates.loadFailed}
        </p>
        <button type="button" onClick={retry} className={SECONDARY_BUTTON}>
          {copy.page.tryAgain}
        </button>
      </div>
    );
  }

  if (summaries === null) return null;

  const report = summaries.find((summary) => summary.kind === 'stay_report') ?? null;
  const forThisDay = (kind: SummaryKind): StaySummary | null =>
    summaries.find((summary) => summary.kind === kind && summary.date === date) ?? null;
  const arrival = forThisDay('arrival');
  const update = forThisDay('daily');
  const now = new Date();
  const isToday = date === aucklandIsoDate(now);
  const waiting = update === null && isToday && aucklandHour(now) < digestHour;

  if (report === null && arrival === null && update === null && !waiting) return null;

  const dailyTitle = isToday
    ? copy.updates.todayTitle
    : copy.updates.dayTitle(formatCareDay(date, locale));

  return (
    <>
      {report !== null && <StayReportCard report={report} petName={careDay.petName} />}
      {arrival !== null && (
        <SummaryCard
          title={copy.updates.arrivalTitle}
          summary={arrival}
          petName={careDay.petName}
        />
      )}
      {update !== null && (
        <SummaryCard title={dailyTitle} summary={update} petName={careDay.petName} />
      )}
      {waiting && (
        <p className="type-meta m-0 rounded-2xl border border-dashed border-border-soft p-4 text-center">
          {copy.updates.waiting(copy.updates.updateHour(digestHour))}
        </p>
      )}
    </>
  );
}
