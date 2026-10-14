import React, { useEffect } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export type CardConfirmResult = { ok: true; setupId: string } | { ok: false; message: string };

/**
 * The Stripe errors written for the guest, in the language the card form was opened in (its
 * `locale`). Stripe's other errors are English and meant for developers, so the page says its
 * own sentence instead.
 */
const GUEST_ERROR_TYPES: ReadonlySet<string> = new Set(['card_error', 'validation_error']);
export type CardConfirm = () => Promise<CardConfirmResult>;

interface StripeCardFormProps {
  setupId: string;
  /** Said when Stripe gives no message of its own. */
  fallbackError: string;
  /** Said when the setup did not finish, e.g. the bank check was closed. */
  notFinished: string;
  onConfirmReady: (confirm: CardConfirm | null) => void;
}

/**
 * Stripe's card form. The card number goes from this form to Stripe and never to Wagstay. When the
 * guest books, the page asks this form to confirm the setup; Stripe runs any bank check (3-D
 * Secure) in its own window and the setup id is then sent with the booking.
 */
export const StripeCardForm: React.FC<StripeCardFormProps> = ({
  setupId,
  fallbackError,
  notFinished,
  onConfirmReady,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) {
      onConfirmReady(null);
      return undefined;
    }
    onConfirmReady(async () => {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        const forGuest = GUEST_ERROR_TYPES.has(error.type) ? error.message : undefined;
        return { ok: false, message: forGuest ?? fallbackError };
      }
      if (setupIntent?.status !== 'succeeded') return { ok: false, message: notFinished };
      return { ok: true, setupId };
    });
    return (): void => onConfirmReady(null);
  }, [stripe, elements, setupId, fallbackError, notFinished, onConfirmReady]);

  return <PaymentElement options={{ layout: 'tabs' }} />;
};
