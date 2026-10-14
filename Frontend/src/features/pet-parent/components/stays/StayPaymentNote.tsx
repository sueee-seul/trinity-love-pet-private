import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { PetStay, StayCard } from '../../types/stays';
import { formatMoney, isOnBooking } from './stayChangeRules';
import { STAYS_COPY, type StaysCopy } from './staysCopy';

const noteFor = (stay: PetStay, card: StayCard, copy: StaysCopy['payment']): string => {
  if (stay.status === 'refused') return copy.refused(stay.pet.name);
  if (stay.status === 'cancelled') {
    if (card.capturedAmount) return copy.cancelledWithFee(formatMoney(card.capturedAmount));
    return card.status === 'refunded' ? copy.refunded : copy.cancelledFree;
  }
  if (card.capturedAmount !== null) {
    if (card.capturedAmount > 0) return copy.finalCharge(formatMoney(card.capturedAmount));
    return card.status === 'refunded' ? copy.refunded : copy.nothingCharged;
  }
  if (card.status === 'succeeded') return copy.paid(formatMoney(card.amount));
  if (stay.status === 'waiting_for_review') {
    // Paid at request, the price is held while our manager checks; older bookings held nothing.
    return card.status === 'authorized'
      ? copy.heldWhileReviewed(formatMoney(card.amount))
      : copy.savedWhileReviewed;
  }
  if (card.status === 'authorized') {
    // Paid at request, a confirmed pet's price is charged once every pet on the booking is decided;
    // older bookings were charged at the desk.
    return card.paysAtRequest
      ? copy.heldUntilDecided(formatMoney(card.amount))
      : copy.held(formatMoney(card.amount));
  }
  if (card.status === 'failed') return copy.holdFailed;
  return copy.notHeldYet;
};

/** What the saved card behind a stay is doing, in one line; plainly marked when it is a test. */
export function StayPaymentNote({ stay }: { stay: PetStay }): ReactElement | null {
  const copy = usePortalCopy(STAYS_COPY).payment;
  const { card } = stay;
  if (!card) return null;
  const problem = card.status === 'failed' && isOnBooking(stay);
  return (
    <p
      className={`type-meta m-0 mt-3 ${problem ? 'font-semibold text-status-danger' : 'text-notice-secondary'}`}
    >
      {noteFor(stay, card, copy)}
      {card.testMode && <span className="text-notice-muted"> {copy.testMode}</span>}
    </p>
  );
}
