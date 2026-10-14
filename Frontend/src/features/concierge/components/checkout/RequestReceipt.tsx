import React, { useState } from 'react';
import { formatTimeLabel } from '../../../../shared/components/ui/date';
import type { ConciergeCopy } from '../../copy';
import type { BookedStay } from '../../store/persistence';
import type { ConciergeCheckoutResponse, ConciergeLocale, ConciergeNeeds } from '../../types';
import { formatDateRange, formatNzd, gstIncluded, nightsBetween } from '../../utils/format';
import { addonNamesIn, stayNameText } from '../../utils/stayName';
import { CARD_TITLE, EYEBROW, SURFACE_CARD, TEXT_BUTTON } from '../conciergeStyles';

interface RequestReceiptProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  result: ConciergeCheckoutResponse;
  /** The agreed stay as kept after sending: its dates, nothing personal. */
  needs: ConciergeNeeds;
  /**
   * The lines of the stay the price covers. Null only for a request whose stay the tab no longer
   * holds; the receipt then leaves the stay rows out rather than guess.
   */
  booked: BookedStay | null;
  /** The drop-off and pick-up times from the details step, when this tab still has them. */
  times: { dropOffTime: string; pickUpTime: string } | null;
}

interface PetStatusLine {
  key: string;
  /** The pet's name, or "Pet 2" when the tab kept no name; a single pet needs no label. */
  petLabel: string | null;
  confirmed: boolean;
}

const ReceiptRow: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  wide = false,
  children,
}) => (
  <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
    <dt className={EYEBROW}>{label}</dt>
    <dd className="m-0 mt-1 type-body font-semibold [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

/**
 * One status line per pet, as the server decided it: confirmed at once, or waiting for our
 * manager. A result saved before statuses existed has none, so it shows one waiting line.
 */
const petStatusLines = (
  copy: ConciergeCopy,
  result: ConciergeCheckoutResponse,
): PetStatusLine[] => {
  const pets = result.pets ?? [];
  if (pets.length === 0) return [{ key: 'request', petLabel: null, confirmed: false }];
  return pets.map((pet, index) => ({
    key: result.bookingPetIds[index] ?? `pet-${index}`,
    petLabel: pets.length > 1 ? pet.name || copy.done.forPet(index) : null,
    confirmed: pet.status === 'confirmed',
  }));
};

/**
 * What was sent, as a plain receipt: each pet's status, the stay, and a total labelled as not
 * charged. A pet is shown as confirmed only when the server confirmed it; a waiting stay is never
 * called booked (Fair Trading Act s9, s11), and the last line says so in words. The boarding pass
 * itself lives in My stays.
 */
export const RequestReceipt: React.FC<RequestReceiptProps> = ({
  copy,
  locale,
  result,
  needs,
  booked,
  times,
}) => {
  const { done, stay } = copy;
  const [copied, setCopied] = useState(false);
  const addons = booked ? addonNamesIn(booked.lines, locale) : [];
  const lines = petStatusLines(copy, result);

  const copyReference = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(result.confirmationNumber);
      setCopied(true);
    } catch {
      // Clipboard blocked: the reference is on screen and can be selected by hand.
      setCopied(false);
    }
  };

  return (
    <section
      aria-labelledby="concierge-receipt-title"
      className={`${SURFACE_CARD} p-5 sm:p-7 print:break-inside-avoid print:shadow-none`}
    >
      <h3 id="concierge-receipt-title" className={CARD_TITLE}>
        {done.receiptTitle}
      </h3>

      <dl className="m-0 mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <ReceiptRow label={done.reference} wide>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-fraunces text-card-title font-bold tabular-nums">
              {result.confirmationNumber}
            </span>
            <button
              type="button"
              onClick={() => void copyReference()}
              className={`${TEXT_BUTTON} px-0 print:hidden`}
            >
              {copied ? done.referenceCopied : done.copyReference}
            </button>
          </span>
        </ReceiptRow>
        <ReceiptRow label={done.status} wide>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {lines.map((line) => (
              <li key={line.key} className="flex flex-wrap items-center gap-2">
                {line.petLabel && <span>{line.petLabel}</span>}
                <span className="inline-flex items-center gap-2 rounded-full bg-surface-cream px-3 py-1 type-meta font-semibold text-notice-primary">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      line.confirmed ? 'bg-status-success' : 'bg-status-warning'
                    }`}
                  />
                  {line.confirmed ? done.confirmed : done.waitingForReview}
                </span>
              </li>
            ))}
          </ul>
        </ReceiptRow>
        {needs.startDate && needs.endDate && (
          <ReceiptRow label={stay.dates} wide>
            {formatDateRange(needs.startDate, needs.endDate, locale)} ·{' '}
            {stay.nights(nightsBetween(needs.startDate, needs.endDate))}
          </ReceiptRow>
        )}
        {times && (
          <>
            <ReceiptRow label={done.dropOff}>
              {formatTimeLabel(times.dropOffTime, locale)}
            </ReceiptRow>
            <ReceiptRow label={done.pickUp}>{formatTimeLabel(times.pickUpTime, locale)}</ReceiptRow>
          </>
        )}
        {booked && (
          <>
            <ReceiptRow label={stay.chosen} wide>
              {/* The tab keeps no pet names after sending, so several pets read as "Pet 1". */}
              {stayNameText(booked.lines, [], copy, locale)}
            </ReceiptRow>
            <ReceiptRow label={stay.extras} wide>
              {addons.length > 0 ? addons.join(copy.listJoiner) : stay.none}
            </ReceiptRow>
          </>
        )}
      </dl>

      <div className="mt-5 border-t border-border-soft pt-4">
        <dl className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <dt className={EYEBROW}>
            {result.payment.status === 'charged' ? done.totalPaid : done.totalHeld}
          </dt>
          <dd className="m-0 font-fraunces text-card-title font-bold tabular-nums text-notice-primary">
            {formatNzd(result.total)}
          </dd>
        </dl>
        <p className="mb-0 mt-1 type-meta">
          {copy.packages.includesGst(formatNzd(gstIncluded(result.total)))}
        </p>
      </div>

      {lines.some((line) => !line.confirmed) && (
        <p className="mb-0 mt-4 rounded-2xl bg-surface-cream p-4 type-body font-semibold text-notice-primary">
          {done.waitingNotBooked}
        </p>
      )}
      <p role="status" className="sr-only">
        {copied ? done.referenceCopied : ''}
      </p>
    </section>
  );
};
