import React, { useState } from 'react';
import type { ConciergeCopy } from '../copy';
import type { ConciergeStatus } from '../hooks/useConciergeStatus';
import { useConciergeStore } from '../store/conciergeStore';
import { buildPlanSummary, planMailtoHref } from '../utils/planSummary';
import { ConciergeDialog } from './ConciergeDialog';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_BUTTON } from './conciergeStyles';

interface HandoffPanelProps {
  copy: ConciergeCopy;
  status: ConciergeStatus;
  open: boolean;
  onClose: () => void;
  /** Offered when the guest may already have an account. */
  onSignIn?: () => void;
  /** For a signed-in parent: sends the plan to our team in their chat. */
  onSendInChat?: (plan: string) => Promise<void>;
}

/**
 * A person, with the plan in hand. The guest's own mail app sends the plan (dates, pets, the stay
 * as built and its price, but never their contact details), so no email provider is needed
 * and nothing is stored until they choose to send it. The phone number is there for anyone who
 * would rather talk.
 */
export const HandoffPanel: React.FC<HandoffPanelProps> = ({
  copy,
  status,
  open,
  onClose,
  onSignIn,
  onSendInChat,
}) => {
  const locale = useConciergeStore((state) => state.locale);
  const needs = useConciergeStore((state) => state.needs);
  const stay = useConciergeStore((state) => state.stayQuote);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const summary = buildPlanSummary(copy, locale, needs, stay);
  const { handoff } = copy;

  const copyPlan = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      // Clipboard blocked: the plan is on screen and can be selected by hand.
      setCopied(false);
    }
  };

  const sendInChat = async (): Promise<void> => {
    if (!onSendInChat) return;
    setSending(true);
    try {
      await onSendInChat(summary);
    } finally {
      setSending(false);
    }
  };

  return (
    <ConciergeDialog
      open={open}
      title={handoff.title}
      closeLabel={handoff.close}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
    >
      <p className="m-0 type-body text-notice-secondary">{handoff.lead}</p>
      <pre className="m-0 whitespace-pre-wrap rounded-2xl bg-surface-cream p-4 type-meta text-notice-primary [overflow-wrap:anywhere]">
        {summary}
      </pre>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {onSendInChat && (
          <button
            type="button"
            onClick={() => void sendInChat()}
            disabled={sending}
            className={PRIMARY_BUTTON}
          >
            {sending ? handoff.sendingInChat : handoff.sendInChat}
          </button>
        )}
        {status.teamEmail && (
          <a
            href={planMailtoHref(status.teamEmail, handoff.planSubject, summary)}
            className={PRIMARY_BUTTON}
          >
            {handoff.emailPlan}
          </a>
        )}
        <button type="button" onClick={() => void copyPlan()} className={SECONDARY_BUTTON}>
          {copied ? handoff.copied : handoff.copyPlan}
        </button>
      </div>
      <p role="status" className="sr-only">
        {copied ? handoff.copied : ''}
      </p>
      <div className="flex flex-col gap-1 type-body">
        {status.teamPhone && (
          <a
            href={`tel:${status.teamPhone.replace(/[^\d+]/g, '')}`}
            className={`${TEXT_BUTTON} px-0`}
          >
            {handoff.call(status.teamPhone)}
          </a>
        )}
        {status.teamEmail && (
          <span className="[overflow-wrap:anywhere]">{handoff.emailUs(status.teamEmail)}</span>
        )}
        {!status.teamEmail && !status.teamPhone && !onSendInChat && (
          // No real contact is configured: never show a made-up address a stranger could own.
          <span className="text-notice-secondary">{handoff.noContact}</span>
        )}
      </div>
      {onSignIn && (
        <button type="button" onClick={onSignIn} className={`${TEXT_BUTTON} self-start px-0`}>
          {handoff.signInInstead}
        </button>
      )}
    </ConciergeDialog>
  );
};
