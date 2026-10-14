import React, { useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import type { ConciergeCopy } from '../../copy';
import type { CardGuarantee } from '../../hooks/useCardGuarantee';
import type { ConciergeBookingPolicy, ConciergeLocale } from '../../types';
import { formatNzd } from '../../utils/format';
import { stripeFor } from '../../utils/stripeLoader';
import { ERROR_TEXT, GROUP_LEGEND, HELP_TEXT, SECONDARY_BUTTON } from '../conciergeStyles';
import { StripeCardForm, type CardConfirm } from './StripeCardForm';

interface CardGuaranteeSectionProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  amount: number;
  /** Null until the page has read the fee rules; they are never guessed. */
  policy: ConciergeBookingPolicy | null;
  guarantee: CardGuarantee;
  onConfirmReady: (confirm: CardConfirm | null) => void;
  /** Said instead of "loading" while the card cannot be set up yet (a guest's email is not in). */
  waitingHint?: string | null;
}

/** The development fake has no card form: confirming just hands back its setup id. */
const FakeCardConfirm: React.FC<{
  setupId: string;
  onConfirmReady: (confirm: CardConfirm | null) => void;
}> = ({ setupId, onConfirmReady }) => {
  useEffect(() => {
    onConfirmReady(async () => ({ ok: true, setupId }));
    return (): void => onConfirmReady(null);
  }, [setupId, onConfirmReady]);
  return null;
};

/**
 * The card the request is paid with: its full price is held when the request is sent and charged
 * once the stays are confirmed. The rules for holding, charging and refunding are shown here, in
 * full, before the guest commits (Fair Trading Act 1986 s9 and the transparency test in s46L;
 * Commerce Commission v Bachcare [2025] NZHC 3661). The guest agrees to them with the terms box
 * below, which the server records (Stripe: the customer's agreement to later charges is recorded).
 */
export const CardGuaranteeSection: React.FC<CardGuaranteeSectionProps> = ({
  copy,
  locale,
  amount,
  policy,
  guarantee,
  onConfirmReady,
  waitingHint = null,
}) => {
  const { card } = copy.details;
  const { state } = guarantee;
  const waitingText =
    state.status === 'waiting' && waitingHint
      ? waitingHint
      : state.status === 'waiting' || state.status === 'loading'
        ? card.loading
        : null;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className={GROUP_LEGEND}>{card.title}</legend>
      {policy && (
        <p className="m-0 type-body">{card.lead(formatNzd(amount), policy.reviewWindowHours)}</p>
      )}

      {state.status === 'ready' &&
        state.setup.processor === 'stripe' &&
        state.setup.publishableKey && (
          <Elements
            key={state.setup.setupId}
            stripe={stripeFor(state.setup.publishableKey)}
            options={{
              clientSecret: state.setup.clientSecret,
              locale: locale === 'zh' ? 'zh' : 'en',
            }}
          >
            <StripeCardForm
              setupId={state.setup.setupId}
              fallbackError={copy.errors.cardDeclined}
              notFinished={copy.errors.cardNotReady}
              onConfirmReady={onConfirmReady}
            />
          </Elements>
        )}
      {state.status === 'ready' && state.setup.processor === 'fake' && (
        <FakeCardConfirm setupId={state.setup.setupId} onConfirmReady={onConfirmReady} />
      )}
      {state.status === 'ready' && state.setup.testMode && (
        <p
          role="note"
          className="m-0 rounded-2xl bg-surface-cream px-3 py-2.5 type-meta text-notice-secondary"
        >
          {state.setup.processor === 'stripe' ? card.testStripe : card.testFake}
        </p>
      )}
      {waitingText && <p className={HELP_TEXT}>{waitingText}</p>}
      {state.status === 'unavailable' && (
        <p role="alert" className={ERROR_TEXT}>
          {card.unavailable}
        </p>
      )}
      {state.status === 'error' && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className={ERROR_TEXT}>
            {card.failed} {state.text(copy)}
          </p>
          <button type="button" onClick={guarantee.reload} className={SECONDARY_BUTTON}>
            {card.retry}
          </button>
        </div>
      )}

      {policy && (
        <div className="rounded-2xl border border-border-soft p-4">
          <p className="m-0 type-body font-semibold">{card.rulesTitle}</p>
          <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 type-meta text-notice-secondary">
            {copy.feeRules(policy).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
};
