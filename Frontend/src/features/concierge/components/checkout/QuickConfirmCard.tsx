import React from 'react';
import type { ConciergeCopy } from '../../copy';
import { useConciergeStatus } from '../../hooks/useConciergeStatus';
import { useQuickConfirm } from '../../hooks/useQuickConfirm';
import { QUICK_CONFIRM_COPY } from '../../quickConfirmCopy';
import { selectBookedNeeds, useConciergeStore } from '../../store/conciergeStore';
import { formatDateRange, formatNzd } from '../../utils/format';
import { stayNameText } from '../../utils/stayName';
import {
  CARD_TITLE,
  ERROR_TEXT,
  PRIMARY_BUTTON,
  SURFACE_CARD,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { CardGuaranteeSection } from './CardGuaranteeSection';
import { FullTermsDisclosure } from './FullTermsDisclosure';

interface QuickConfirmCardProps {
  copy: ConciergeCopy;
  /** Opens the full form, for a guest who wants to check or change what the assistant filled in. */
  onEditDetails: () => void;
  /** The chat is on screen, so a typed "confirm" works too. */
  chatOpen: boolean;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-notice-muted">{label}</dt>
    <dd className="m-0 text-right text-notice-primary">{children}</dd>
  </div>
);

/**
 * "Book it for me", finished in one press: the stay the assistant set up, its price, the card, the
 * terms in short with every clause on demand, and one sentence that gives both agreements the full
 * form asks for with its two boxes. When the chat did not give everything the booking needs, the
 * card says so and sends the guest to the full form instead of guessing.
 */
export const QuickConfirmCard: React.FC<QuickConfirmCardProps> = ({
  copy,
  onEditDetails,
  chatOpen,
}) => {
  const locale = useConciergeStore((state) => state.locale);
  const accepted = useConciergeStore((state) => state.accepted);
  const quote = useConciergeStore((state) => state.agreedQuote);
  const needs = useConciergeStore(selectBookedNeeds);
  const status = useConciergeStatus();
  const quick = useQuickConfirm(copy);
  const words = QUICK_CONFIRM_COPY[locale];
  const petNames = needs.pets.map((pet) => pet.name);
  const termsSummary = copy.details.termsSummary.map((term) =>
    term.replace(words.tickClause, words.tickClauseHere),
  );

  return (
    <section
      aria-labelledby="concierge-quick-confirm-title"
      className={`${SURFACE_CARD} flex min-w-0 flex-col gap-6 p-6 sm:p-8`}
    >
      <div>
        <h2 id="concierge-quick-confirm-title" className={CARD_TITLE}>
          {words.title}
        </h2>
        <p className="mb-0 mt-2 type-body text-notice-secondary">{words.lead}</p>
      </div>

      <dl className="m-0 flex flex-col gap-3 type-body">
        <Row label={words.stay}>
          {quote ? stayNameText(quote.lines, petNames, copy, locale) : (accepted?.name ?? '')}
        </Row>
        {needs.startDate && needs.endDate && (
          <Row label={words.dates}>{formatDateRange(needs.startDate, needs.endDate, locale)}</Row>
        )}
        {petNames.length > 0 && <Row label={words.pets}>{petNames.join(copy.listJoiner)}</Row>}
        <div className="border-t border-border-soft pt-3">
          <Row label={words.total}>
            <span className="font-bold tabular-nums">
              {accepted ? formatNzd(accepted.total) : ''}
            </span>
          </Row>
        </div>
      </dl>

      {quick.missing.length > 0 ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="m-0 type-body font-semibold">{words.missingTitle}</p>
          <ul className="m-0 list-disc pl-5 type-meta text-notice-primary">
            {quick.missing.map((field) => (
              <li key={field}>{copy.details.errors[field]}</li>
            ))}
          </ul>
          <p className="m-0 type-meta text-notice-secondary">{words.missingLead}</p>
          <button type="button" onClick={onEditDetails} className={`${PRIMARY_BUTTON} self-start`}>
            {words.fillDetails}
          </button>
        </div>
      ) : (
        <>
          <CardGuaranteeSection
            copy={copy}
            locale={locale}
            amount={accepted?.total ?? 0}
            policy={status.policy}
            guarantee={quick.guarantee}
            onConfirmReady={quick.onConfirmReady}
          />

          <div className="flex flex-col gap-3">
            <p className="m-0 type-body font-semibold">{copy.details.requestNotice}</p>
            <ul className="m-0 list-disc space-y-1.5 pl-5 type-meta text-notice-secondary">
              {termsSummary.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <FullTermsDisclosure copy={copy.details.fullTerms} />
            <p className="m-0 type-meta text-notice-primary">{words.consent}</p>
          </div>

          {quick.failure && (
            <p role="alert" className={ERROR_TEXT}>
              {quick.failure}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onEditDetails} className={TEXT_BUTTON}>
              {words.editDetails}
            </button>
            <button
              type="button"
              aria-disabled={quick.busy}
              onClick={() => void quick.confirm()}
              className={`${PRIMARY_BUTTON} aria-disabled:cursor-wait aria-disabled:opacity-70`}
            >
              {quick.busy ? words.confirming : words.confirm}
            </button>
          </div>
          {chatOpen && <p className="m-0 type-meta text-notice-secondary">{words.replyHint}</p>}
        </>
      )}
    </section>
  );
};
