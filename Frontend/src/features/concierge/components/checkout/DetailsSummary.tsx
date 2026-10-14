import React from 'react';
import type { ConciergeCopy } from '../../copy';
import type {
  ConciergeAcceptQuoteResponse,
  ConciergeLocale,
  ConciergeNeeds,
  ConciergeQuote,
} from '../../types';
import { formatClockTime, formatDateRange, formatNzd } from '../../utils/format';
import { addonNamesIn, stayNameText } from '../../utils/stayName';
import { CARD_TITLE, SURFACE_CARD, TEXT_BUTTON } from '../conciergeStyles';
import { StayLines } from '../stay/StayLines';

/** The agreed price stays honoured for as long as the agreement token is valid (60 minutes). */
const AGREEMENT_HOLD_MS = 60 * 60 * 1000;

interface DetailsSummaryProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  /** The agreed plan, never an edit made after agreeing. */
  needs: ConciergeNeeds;
  accepted: ConciergeAcceptQuoteResponse | null;
  /** The priced stay the acceptance was for, with every line the total covers. */
  quote: ConciergeQuote | null;
  verifiedEmail: string | null;
  titleId: string;
  onBack: () => void;
}

const SummaryRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex justify-between gap-3">
    <dt className="text-notice-muted">{label}</dt>
    <dd className="m-0 min-w-0 text-right font-semibold text-notice-primary [overflow-wrap:anywhere]">
      {children}
    </dd>
  </div>
);

/**
 * What the request holds, beside the form: the stay as agreed, its dates, how many guests, the
 * add-ons its price covers, every line and the total, so the guest can see what the price covers
 * before sending. The lines are the server's, so nothing is listed that the price does not include.
 */
export const DetailsSummary: React.FC<DetailsSummaryProps> = ({
  copy,
  locale,
  needs,
  accepted,
  quote,
  verifiedEmail,
  titleId,
  onBack,
}) => {
  const { details, stay } = copy;
  const petNames = needs.pets.map((pet) => pet.name);
  const addons = quote ? addonNamesIn(quote.lines, locale) : null;
  return (
    <aside
      aria-labelledby={titleId}
      // The page sets the sticky offset: the portal's own top bar is pinned above it.
      className={`${SURFACE_CARD} order-first h-fit p-6 lg:order-last lg:sticky lg:top-(--concierge-sticky-top)`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className={CARD_TITLE}>
          {details.summaryTitle}
        </h2>
        <button type="button" onClick={onBack} className={TEXT_BUTTON}>
          {details.change}
        </button>
      </div>
      <dl className="m-0 mt-4 flex flex-col gap-3 type-body">
        <SummaryRow label={stay.chosen}>
          {quote ? stayNameText(quote.lines, petNames, copy, locale) : (accepted?.name ?? '')}
        </SummaryRow>
        {needs.startDate && needs.endDate && (
          <SummaryRow label={stay.dates}>
            {formatDateRange(needs.startDate, needs.endDate, locale)}
          </SummaryRow>
        )}
        {needs.pets.length > 0 && <SummaryRow label={stay.guests}>{needs.pets.length}</SummaryRow>}
        {addons && (
          <SummaryRow label={stay.extras}>
            {addons.length > 0 ? addons.join(copy.listJoiner) : stay.none}
          </SummaryRow>
        )}
        {verifiedEmail && <SummaryRow label={copy.verify.emailLabel}>{verifiedEmail}</SummaryRow>}
        <div className="flex items-baseline justify-between gap-3 border-t border-border-soft pt-3">
          <dt className="text-notice-muted">{copy.packages.totalLabel}</dt>
          <dd className="m-0 font-fraunces text-display font-bold leading-none tabular-nums text-notice-primary">
            {accepted ? formatNzd(accepted.total) : ''}
          </dd>
        </div>
      </dl>
      {quote && (
        <div className="mt-4 border-t border-border-soft pt-3">
          <StayLines copy={copy} locale={locale} lines={quote.lines} petNames={petNames} />
        </div>
      )}
      {accepted && (
        <p className="mb-0 mt-2 type-meta">
          {copy.packages.validUntil(
            formatClockTime(
              new Date(Date.parse(accepted.acceptedAt) + AGREEMENT_HOLD_MS).toISOString(),
              locale,
            ),
          )}
        </p>
      )}
    </aside>
  );
};
