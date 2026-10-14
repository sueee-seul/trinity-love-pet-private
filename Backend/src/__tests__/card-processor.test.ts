import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardProcessor } from '../services/payments/card-processor.factory.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { StripeCardProcessor } from '../services/payments/stripe-card-processor.js';

const stripe = {
  customers: { list: vi.fn(), create: vi.fn() },
  setupIntents: { create: vi.fn(), retrieve: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
  paymentIntents: { create: vi.fn(), capture: vi.fn(), cancel: vi.fn(), retrieve: vi.fn() },
  refunds: { create: vi.fn() },
};

const processor = new StripeCardProcessor(stripe as unknown as Stripe, 'pk_test_123');

const HOLD = {
  paymentMethodId: 'pm_123',
  amount: 204.35,
  reference: 'PB-AAAAAA',
  idempotencyKey: 'hold-booking-1',
};

const cardError = (code: string): Stripe.errors.StripeCardError =>
  new Stripe.errors.StripeCardError({
    type: 'card_error',
    code,
    message: 'The card was not accepted',
    payment_intent: { id: 'pi_declined' } as Stripe.PaymentIntent,
  });

describe('createCardProcessor', () => {
  it('uses Stripe when both keys are set, and knows a test key', () => {
    const chosen = createCardProcessor({
      STRIPE_SECRET_KEY: 'sk_test_abc',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
    });
    expect(chosen?.name).toBe('stripe');
    expect(chosen?.publishableKey).toBe('pk_test_abc');
    expect(chosen?.testMode).toBe(true);
    expect(
      createCardProcessor({
        STRIPE_SECRET_KEY: 'sk_live_abc',
        STRIPE_PUBLISHABLE_KEY: 'pk_live_abc',
      })?.testMode,
    ).toBe(false);
  });

  it('uses the fake only when asked for, and never in production', () => {
    expect(createCardProcessor({ CONCIERGE_PAYMENT_MODE: 'fake' })?.name).toBe('fake');
    expect(
      createCardProcessor({ CONCIERGE_PAYMENT_MODE: 'fake', NODE_ENV: 'production' }),
    ).toBeNull();
    expect(createCardProcessor({})).toBeNull();
  });

  it('needs the publishable key too, or the page could not show the card form', () => {
    expect(createCardProcessor({ STRIPE_SECRET_KEY: 'sk_test_abc' })).toBeNull();
  });
});

describe('StripeCardProcessor', () => {
  beforeEach(() => {
    for (const group of Object.values(stripe)) {
      for (const method of Object.values(group)) method.mockReset();
    }
    stripe.paymentMethods.retrieve.mockResolvedValue({ id: 'pm_123', customer: 'cus_123' });
  });

  it('saves a card for off-session use, tied to the acceptance, on the guest’s customer', async () => {
    stripe.customers.list.mockResolvedValue({ data: [{ id: 'cus_existing' }] });
    stripe.setupIntents.create.mockResolvedValue({ id: 'seti_1', client_secret: 'seti_1_secret' });

    const setup = await processor.createCardSetup({
      email: 'ava@example.test',
      acceptanceId: 'acceptance-1',
    });

    expect(setup).toEqual({ setupId: 'seti_1', clientSecret: 'seti_1_secret' });
    expect(stripe.customers.create).not.toHaveBeenCalled();
    const [params, options] = stripe.setupIntents.create.mock.calls[0] ?? [];
    expect(params).toEqual({
      customer: 'cus_existing',
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { acceptance_id: 'acceptance-1' },
    });
    expect(options.idempotencyKey).toMatch(/^card-setup-acceptance-1-[0-9a-f]{24}$/);
  });

  it('creates a customer for a new email', async () => {
    stripe.customers.list.mockResolvedValue({ data: [] });
    stripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    stripe.setupIntents.create.mockResolvedValue({ id: 'seti_2', client_secret: 'secret' });

    await processor.createCardSetup({ email: 'new@example.test', acceptanceId: 'acceptance-2' });

    expect(stripe.customers.create.mock.calls[0]?.[0]).toMatchObject({ email: 'new@example.test' });
    expect(stripe.setupIntents.create.mock.calls[0]?.[0]).toMatchObject({ customer: 'cus_new' });
  });

  it('reads a confirmed setup back with its card and acceptance', async () => {
    stripe.setupIntents.retrieve.mockResolvedValue({
      status: 'succeeded',
      payment_method: 'pm_123',
      metadata: { acceptance_id: 'acceptance-1' },
    });
    await expect(processor.readCardSetup('seti_1')).resolves.toEqual({
      status: 'succeeded',
      acceptanceId: 'acceptance-1',
      paymentMethodId: 'pm_123',
    });

    stripe.setupIntents.retrieve.mockResolvedValue({
      status: 'requires_payment_method',
      payment_method: null,
      metadata: {},
    });
    await expect(processor.readCardSetup('seti_1')).resolves.toMatchObject({ status: 'pending' });
  });

  it('holds the amount in cents off-session with manual capture', async () => {
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });

    await expect(processor.placeHold(HOLD)).resolves.toEqual({
      status: 'succeeded',
      paymentIntentId: 'pi_1',
    });
    const [params, options] = stripe.paymentIntents.create.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      amount: 20435,
      currency: 'nzd',
      customer: 'cus_123',
      payment_method: 'pm_123',
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: { booking_reference: 'PB-AAAAAA' },
    });
    expect(options).toEqual({ idempotencyKey: 'hold-booking-1' });
  });

  it('reports a declined card, and a bank asking for 3-D Secure, as results', async () => {
    stripe.paymentIntents.create.mockRejectedValueOnce(cardError('card_declined'));
    await expect(processor.placeHold(HOLD)).resolves.toEqual({
      status: 'failed',
      paymentIntentId: 'pi_declined',
      reason: 'declined',
    });

    stripe.paymentIntents.create.mockRejectedValueOnce(cardError('authentication_required'));
    await expect(processor.placeHold(HOLD)).resolves.toMatchObject({
      reason: 'authentication_required',
    });
  });

  it('throws when Stripe cannot be reached, so the caller can try again later', async () => {
    stripe.paymentIntents.create.mockRejectedValueOnce(new Error('connection reset'));

    await expect(processor.placeHold(HOLD)).rejects.toThrow('connection reset');
  });

  it('captures part of a hold in cents with its own idempotency key', async () => {
    stripe.paymentIntents.capture.mockResolvedValue({ id: 'pi_1', status: 'succeeded' });

    await processor.captureHold('pi_1', 102.18, 'capture-booking-1');

    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith(
      'pi_1',
      { amount_to_capture: 10218 },
      { idempotencyKey: 'capture-booking-1' },
    );
  });

  it('treats releasing an already released hold as done', async () => {
    stripe.paymentIntents.cancel.mockRejectedValueOnce(new Error('already canceled'));
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_1', status: 'canceled' });
    await expect(processor.releaseHold('pi_1')).resolves.toBeUndefined();

    stripe.paymentIntents.cancel.mockRejectedValueOnce(new Error('captured'));
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_1', status: 'succeeded' });
    await expect(processor.releaseHold('pi_1')).rejects.toThrow('captured');
  });

  it('refunds part of a captured payment in cents, once per key', async () => {
    stripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' });

    await processor.refund('pi_1', 102.18, 'refund-cancel-booking-1');

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 10218, reason: 'requested_by_customer' },
      { idempotencyKey: 'refund-cancel-booking-1' },
    );
  });

  it('charges at once for a late cancellation with no hold', async () => {
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_2', status: 'succeeded' });

    await expect(processor.chargeNow(HOLD)).resolves.toEqual({
      status: 'succeeded',
      paymentIntentId: 'pi_2',
    });
    expect(stripe.paymentIntents.create.mock.calls[0]?.[0]).toMatchObject({
      capture_method: 'automatic',
      off_session: true,
    });
  });
});

describe('FakeCardProcessor', () => {
  it('carries the acceptance in the setup id, so it needs no memory', async () => {
    const fake = new FakeCardProcessor();
    const { setupId } = await fake.createCardSetup({ email: 'a@b.test', acceptanceId: 'acc-1' });

    await expect(fake.readCardSetup(setupId)).resolves.toEqual({
      status: 'succeeded',
      acceptanceId: 'acc-1',
      paymentMethodId: 'fake_pm_acc-1',
    });
    await expect(fake.readCardSetup('seti_real')).resolves.toMatchObject({ status: 'failed' });
    expect(fake.testMode).toBe(true);
  });
});
