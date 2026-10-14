import React, { useId, useState } from 'react';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeLocale, ConciergeQuote } from '../../types';
import { formatClockTime, formatNzd, gstIncluded } from '../../utils/format';
import {
  ERROR_TEXT,
  EYEBROW,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { StayLines } from './StayLines';

interface StayTotalProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  quote: ConciergeQuote | null;
  petNames: ReadonlyArray<string | undefined>;
  /** A price is on its way or owed, so the total shown may not be the one to continue with. */
  updating: boolean;
  /** The last pricing attempt failed; the ticks are kept and can be priced again. */
  priceFailed: boolean;
  problem: string | null;
  onRetryPrice: () => void;
  /** Booking online is off (no card processor): continuing hands the plan to the team instead. */
  handoff: boolean;
  onHandoff: () => void;
  onContinue: () => Promise<boolean>;
  agreeing: boolean;
  agreeError: string | null;
}

/**
 * The live total at the foot of the stay panel and the button that continues with it. The single
 * GST-inclusive total is the headline; the breakdown is one press away. Continuing accepts the
 * server's signed price and sends nothing: the terms are agreed on the details step.
 */
export const StayTotal: React.FC<StayTotalProps> = ({
  copy,
  locale,
  quote,
  petNames,
  updating,
  priceFailed,
  problem,
  onRetryPrice,
  handoff,
  onHandoff,
  onContinue,
  agreeing,
  agreeError,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const breakdownId = useId();
  const busy = updating || agreeing;

  const onPress = async (): Promise<void> => {
    if (busy) return;
    if (handoff) {
      onHandoff();
      return;
    }
    await onContinue();
  };

  // In the wide panel the button sits beside the total and the notes run below both, so the
  // footer takes less height from the suggested combos.
  const BELOW = '@3xl:order-3 @3xl:basis-full';
  return (
    <div className="flex flex-col gap-3 @3xl:flex-row @3xl:flex-wrap @3xl:items-end @3xl:gap-x-6">
      <div className="flex flex-wrap items-end justify-between gap-3 @3xl:order-1 @3xl:flex-1">
        <div>
          <p className={EYEBROW}>{copy.packages.totalLabel}</p>
          <p
            aria-live="polite"
            className="m-0 mt-1 font-fraunces text-display font-bold leading-none tabular-nums text-notice-primary"
          >
            {quote ? formatNzd(quote.total) : ''}
          </p>
          <p className="m-0 mt-2 type-meta" aria-live="polite">
            {updating
              ? copy.packages.repricing
              : quote
                ? `${copy.packages.includesGst(formatNzd(gstIncluded(quote.total)))} · ${copy.stay.nights(quote.nights)}`
                : ''}
          </p>
        </div>
        {quote && (
          <button
            type="button"
            aria-expanded={showBreakdown}
            aria-controls={breakdownId}
            onClick={() => setShowBreakdown((value) => !value)}
            className={TEXT_BUTTON}
          >
            {showBreakdown ? copy.packages.hideBreakdown : copy.packages.showBreakdown}
          </button>
        )}
      </div>
      {quote && showBreakdown && (
        <div
          id={breakdownId}
          className={`rounded-2xl border border-border-soft bg-surface-cream/60 p-4 ${BELOW}`}
        >
          <StayLines copy={copy} locale={locale} lines={quote.lines} petNames={petNames} />
        </div>
      )}
      {quote && !updating && (
        <p className={`m-0 type-meta ${BELOW}`}>
          {copy.packages.validUntil(formatClockTime(quote.expiresAt, locale))}
        </p>
      )}
      {problem && (
        <div role="alert" className={`flex flex-wrap items-center gap-3 ${BELOW}`}>
          <p className={ERROR_TEXT}>{problem}</p>
          {priceFailed && (
            <button
              type="button"
              onClick={onRetryPrice}
              className={`${SECONDARY_BUTTON} min-h-11 px-4`}
            >
              {copy.chat.retry}
            </button>
          )}
        </div>
      )}
      {!handoff && (
        <p className={`m-0 type-meta text-notice-secondary ${BELOW}`}>
          {copy.packages.requestNotice}
        </p>
      )}
      <button
        type="button"
        onClick={() => void onPress()}
        aria-disabled={busy}
        className={`${PRIMARY_BUTTON} w-full aria-disabled:cursor-wait aria-disabled:opacity-70 @3xl:order-2 @3xl:w-auto @3xl:min-w-72`}
      >
        {updating
          ? copy.packages.repricing
          : agreeing
            ? copy.packages.agreeing
            : handoff
              ? copy.handoff.title
              : copy.packages.chooseButton}
      </button>
      {agreeError && (
        <p role="alert" className={`${ERROR_TEXT} ${BELOW}`}>
          {agreeError}
        </p>
      )}
    </div>
  );
};
