import { useCallback, useRef, useState } from 'react';
import type { ConciergeCopy } from '../copy';
import type { CardConfirm } from '../components/checkout/StripeCardForm';
import type { CardGuarantee } from './useCardGuarantee';

interface CardConfirmation {
  /** The card form is confirming the card with the processor. */
  confirming: boolean;
  /** Why the card could not be confirmed, in the page language; null when nothing went wrong. */
  cardError: string | null;
  /** Whether the card form can confirm yet; it loads after the card setup and Stripe.js. */
  cardReady: boolean;
  /** The confirmed card's setup id, or null after saying why it could not be confirmed. */
  confirmCard: () => Promise<string | null>;
  /** The card has to be entered again: forget the confirmed setup and fetch a fresh one. */
  startOver: () => void;
  /** Handed to the card form, which registers how to confirm the card once it can. */
  onConfirmReady: (confirm: CardConfirm | null) => void;
}

/**
 * Confirming the saved card before the request is sent. The request goes with that card's setup
 * id, and a card that was confirmed is not confirmed again when the request is resent (after a
 * renewed email check), so the guest never types it twice for the same agreement.
 */
export const useCardConfirmation = (
  guarantee: CardGuarantee,
  copy: ConciergeCopy,
): CardConfirmation => {
  const [confirming, setConfirming] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [confirmedSetupId, setConfirmedSetupId] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const confirmCardRef = useRef<CardConfirm | null>(null);

  const onConfirmReady = useCallback((confirm: CardConfirm | null): void => {
    confirmCardRef.current = confirm;
    setCardReady(confirm !== null);
  }, []);

  const confirmCard = async (): Promise<string | null> => {
    setCardError(null);
    const { state } = guarantee;
    if (state.status === 'unavailable') {
      setCardError(copy.errors.paymentsNotConfigured);
      return null;
    }
    const currentSetupId = state.status === 'ready' ? state.setup.setupId : null;
    if (currentSetupId && confirmedSetupId === currentSetupId) return currentSetupId;
    const confirm = confirmCardRef.current;
    if (!confirm) {
      setCardError(copy.details.card.loading);
      return null;
    }
    setConfirming(true);
    try {
      const result = await confirm();
      if (!result.ok) {
        setCardError(result.message);
        return null;
      }
      setConfirmedSetupId(result.setupId);
      return result.setupId;
    } finally {
      setConfirming(false);
    }
  };

  const startOver = (): void => {
    setConfirmedSetupId(null);
    guarantee.reload();
  };

  return { confirming, cardError, cardReady, confirmCard, startOver, onConfirmReady };
};
