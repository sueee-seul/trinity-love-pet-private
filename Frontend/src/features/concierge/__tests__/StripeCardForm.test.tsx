import { render, type RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { StripeCardForm, type CardConfirm } from '../components/checkout/StripeCardForm';

type ConfirmReady = (confirm: CardConfirm | null) => void;

/** Stripe.js as the card form sees it; `loaded` is false while Stripe.js is still loading. */
const stripeMock = vi.hoisted(() => {
  const confirmSetup = vi.fn();
  return { confirmSetup, stripe: { confirmSetup }, elements: {}, loaded: true };
});

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: (): typeof stripeMock.stripe | null => (stripeMock.loaded ? stripeMock.stripe : null),
  useElements: (): typeof stripeMock.elements | null =>
    stripeMock.loaded ? stripeMock.elements : null,
  PaymentElement: (): null => null,
}));

const renderForm = (onConfirmReady: ConfirmReady): RenderResult =>
  render(
    <StripeCardForm
      setupId="seti_123"
      fallbackError="Your card couldn’t be held."
      notFinished="Please enter your card again."
      onConfirmReady={onConfirmReady}
    />,
  );

const handedOverConfirm = (onConfirmReady: Mock<ConfirmReady>): CardConfirm => {
  const confirm = onConfirmReady.mock.lastCall?.[0];
  if (!confirm) throw new Error('The form did not hand over a confirm');
  return confirm;
};

describe('StripeCardForm', () => {
  beforeEach(() => {
    stripeMock.loaded = true;
    stripeMock.confirmSetup.mockReset();
  });

  it('hands over the setup id once Stripe has confirmed the card, without leaving the page', async () => {
    stripeMock.confirmSetup.mockResolvedValue({ setupIntent: { status: 'succeeded' } });
    const onConfirmReady = vi.fn<ConfirmReady>();
    renderForm(onConfirmReady);

    await expect(handedOverConfirm(onConfirmReady)()).resolves.toEqual({
      ok: true,
      setupId: 'seti_123',
    });
    expect(stripeMock.confirmSetup).toHaveBeenCalledWith({
      elements: stripeMock.elements,
      redirect: 'if_required',
    });
  });

  it('passes on the bank’s reason for a refusal, or a plain one when there is none', async () => {
    stripeMock.confirmSetup
      .mockResolvedValueOnce({
        error: { type: 'card_error', message: 'Your card has insufficient funds.' },
      })
      .mockResolvedValueOnce({ error: { type: 'card_error' } });
    const onConfirmReady = vi.fn<ConfirmReady>();
    renderForm(onConfirmReady);
    const confirm = handedOverConfirm(onConfirmReady);

    await expect(confirm()).resolves.toEqual({
      ok: false,
      message: 'Your card has insufficient funds.',
    });
    await expect(confirm()).resolves.toEqual({ ok: false, message: 'Your card couldn’t be held.' });
  });

  // Stripe words card errors in the form's language; its other errors are English, for developers.
  it('says its own sentence for a Stripe error that is not about the card', async () => {
    stripeMock.confirmSetup.mockResolvedValue({
      error: { type: 'invalid_request_error', message: 'No such setupintent: seti_123' },
    });
    const onConfirmReady = vi.fn<ConfirmReady>();
    renderForm(onConfirmReady);

    await expect(handedOverConfirm(onConfirmReady)()).resolves.toEqual({
      ok: false,
      message: 'Your card couldn’t be held.',
    });
  });

  it('does not book with a card whose bank check was not finished', async () => {
    stripeMock.confirmSetup.mockResolvedValue({ setupIntent: { status: 'requires_action' } });
    const onConfirmReady = vi.fn<ConfirmReady>();
    renderForm(onConfirmReady);

    await expect(handedOverConfirm(onConfirmReady)()).resolves.toEqual({
      ok: false,
      message: 'Please enter your card again.',
    });
  });

  it('offers nothing to confirm while Stripe.js loads, and takes it back when the form closes', () => {
    stripeMock.loaded = false;
    const waiting = vi.fn<ConfirmReady>();
    renderForm(waiting).unmount();
    expect(waiting).toHaveBeenCalledWith(null);
    expect(waiting.mock.calls.every(([confirm]) => confirm === null)).toBe(true);

    stripeMock.loaded = true;
    const ready = vi.fn<ConfirmReady>();
    const form = renderForm(ready);
    expect(ready).toHaveBeenLastCalledWith(expect.any(Function));
    form.unmount();
    expect(ready).toHaveBeenLastCalledWith(null);
  });
});
