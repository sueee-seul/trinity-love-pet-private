import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { previewCancellation } from '../../../api/stayChangesApi';
import type { PetStay } from '../../../types/stays';
import { CancelStayDialog } from '../CancelStayDialog';
import { StayPaymentNote } from '../StayPaymentNote';
import { bookedStay } from './stayFixtures';

// A stay paid at request: the price is held when the request is sent, charged on confirmation,
// and cancelling refunds what is not owed. These lines restate the booking terms.

vi.mock('../../../api/stayChangesApi', () => ({
  previewCancellation: vi.fn(),
  cancelStay: vi.fn(),
}));

const CONTACT = { email: 'hello@wagstay.test', phone: null };

const paidStay = (overrides: Partial<PetStay> = {}): PetStay =>
  bookedStay({
    card: {
      status: 'succeeded',
      amount: 460,
      capturedAmount: null,
      testMode: false,
      paysAtRequest: true,
    },
    ...overrides,
  });

beforeEach(() => {
  vi.mocked(previewCancellation).mockReset();
});

afterEach(() => {
  act(() => useConciergeStore.getState().setLocale('en'));
});

describe('StayPaymentNote for a stay paid at request', () => {
  it('says what was paid and that anything not owed comes back', () => {
    render(<StayPaymentNote stay={paidStay()} />);
    expect(
      screen.getByText(
        "Paid $460.00. Anything you don't owe after check-in goes back to your card.",
      ),
    ).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('zh'));
    expect(
      screen.getByText('已付 $460.00。入住之后不需要支付的部分，会退回你的卡。'),
    ).toBeInTheDocument();
  });

  it('says the price is held while our manager checks a request', () => {
    render(
      <StayPaymentNote
        stay={bookedStay({
          status: 'waiting_for_review',
          reviewStatus: 'pending',
          card: {
            status: 'authorized',
            amount: 230,
            capturedAmount: null,
            testMode: false,
            paysAtRequest: true,
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        '$230.00 is held on your card while our manager checks. It is charged once confirmed, or released.',
      ),
    ).toBeInTheDocument();
  });

  it('says a confirmed pet is charged once every pet on the booking is decided, not at check-in', () => {
    const heldWhileAnotherWaits = (paysAtRequest: boolean): PetStay =>
      bookedStay({
        card: {
          status: 'authorized',
          amount: 230,
          capturedAmount: null,
          testMode: false,
          paysAtRequest,
        },
      });
    const { rerender } = render(<StayPaymentNote stay={heldWhileAnotherWaits(true)} />);
    expect(
      screen.getByText(
        '$230.00 is held on your card. We charge the confirmed pets once our manager has decided on every pet in this booking.',
      ),
    ).toBeInTheDocument();

    // An older booking was held 48 hours ahead and charged at the desk.
    rerender(<StayPaymentNote stay={heldWhileAnotherWaits(false)} />);
    expect(
      screen.getByText('$230.00 is held on your card. It is charged when you check in.'),
    ).toBeInTheDocument();
  });

  it('says a cancelled paid stay was refunded in full', () => {
    render(
      <StayPaymentNote
        stay={bookedStay({
          status: 'cancelled',
          card: {
            status: 'refunded',
            amount: 460,
            capturedAmount: 0,
            testMode: false,
            paysAtRequest: true,
          },
        })}
      />,
    );

    expect(screen.getByText('Refunded in full.')).toBeInTheDocument();
  });
});

describe('CancelStayDialog for a stay paid at request', () => {
  const open = (): void => {
    render(
      <CancelStayDialog
        stay={paidStay()}
        petNames={['Biscuit', 'Mochi']}
        onClose={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );
  };

  it('says the fee is kept and the rest refunded', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 120,
      rule: 'late',
      total: 460,
      contact: CONTACT,
    });
    open();

    expect(
      await screen.findByText(
        'Cancelling now costs $120.00 under the cancellation rules you agreed to. We refund the rest of what you paid to your card.',
      ),
    ).toBeInTheDocument();
  });

  it('says a free cancellation gives everything back', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 0,
      rule: 'early',
      total: 460,
      contact: CONTACT,
    });
    open();

    expect(
      await screen.findByText(
        'Cancelling now is free. Everything you paid goes back to your card.',
      ),
    ).toBeInTheDocument();
  });
});
