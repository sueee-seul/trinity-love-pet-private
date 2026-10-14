import type { ReactElement } from 'react';
import type { CardGuaranteeSummary } from '../../types/booking';
import { formatNzd } from '../../utils/bookingDesk';

interface CardGuaranteeNoteProps {
  card: CardGuaranteeSummary;
}

const settledText = (card: CardGuaranteeSummary, kept: number): string => {
  if (kept > 0) return `Charged ${formatNzd(kept)} for the booking.`;
  return card.status === 'refunded'
    ? 'Refunded in full. Nothing was kept.'
    : 'Card hold released. Nothing was charged.';
};

const openText = (card: CardGuaranteeSummary): string => {
  if (card.status === 'failed') {
    return 'Card hold failed. Ask the guest for another card, or take payment at the desk.';
  }
  // Pay at request: charged when every pet is decided; the desk refunds what is not owed.
  if (card.status === 'succeeded') {
    return `Paid: ${formatNzd(card.amount)}. Finishing check-in refunds what is not owed.`;
  }
  if (card.status === 'authorized') {
    return card.pays_at_request
      ? `Held: ${formatNzd(card.amount)} while the request is decided. Confirmed pets are charged, the rest released.`
      : `Card held: ${formatNzd(card.amount)}. Charged at check-in.`;
  }
  return `Card saved. ${formatNzd(card.amount)} is held 48 hours before drop-off.`;
};

/** What the saved card behind a booking is doing, in one line, and plainly when it is a test. */
export function CardGuaranteeNote({ card }: CardGuaranteeNoteProps): ReactElement {
  const failed = card.status === 'failed';
  const text =
    card.captured_amount !== null ? settledText(card, card.captured_amount) : openText(card);

  return (
    <p
      className={`mt-2 flex flex-wrap items-center gap-2 text-[12px] ${failed ? 'font-semibold text-status-danger' : 'text-notice-primary'}`}
    >
      <span>{text}</span>
      {card.test_mode && (
        <span className="rounded-full bg-surface-cream px-2 py-0.5 type-meta font-bold text-notice-secondary">
          TEST: no real money
        </span>
      )}
    </p>
  );
}
