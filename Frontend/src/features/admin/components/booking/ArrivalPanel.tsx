import type { ReactElement } from 'react';
import type { CheckInOutcome, ManagerBookingRecord } from '../../types/booking';
import {
  amountDueAtDesk,
  CHECK_IN_OUTCOMES,
  formatNzd,
  OUTCOME_LABELS,
} from '../../utils/bookingDesk';

interface ArrivalPanelProps {
  /** This card's pet. */
  booking: ManagerBookingRecord;
  /** Every pet on the same booking: check-in is finished for all of them at once. */
  petsOfBooking: ManagerBookingRecord[];
  /** Only one card per booking offers to finish check-in. */
  showFinish: boolean;
  isBusy: boolean;
  /**
   * Turning a pet away releases its price with no fee, so only a manager can choose it. Staff
   * still see it when a manager already chose it.
   */
  canTurnAway: boolean;
  onRecordArrival: (bookingPetsUuid: string, outcome: CheckInOutcome) => void;
  onFinishCheckIn: (bookingId: string) => void;
}

const TURNED_AWAY: CheckInOutcome = 'wagstay_unable';

const finishLabel = (amount: number, cardFailed: boolean): string => {
  if (cardFailed) return `Finish check-in: ${formatNzd(amount)} to take at the desk`;
  return amount > 0
    ? `Finish check-in: charge ${formatNzd(amount)}`
    : 'Finish check-in: release the hold';
};

const confirmText = (amount: number, cardFailed: boolean): string => {
  if (cardFailed) {
    return `The card hold failed earlier, so nothing is charged online. Take ${formatNzd(amount)} at the desk. Finish check-in?`;
  }
  return amount > 0
    ? `Charge ${formatNzd(amount)} to the guest's card and release the rest of the hold?`
    : 'Nothing is due. Release the whole card hold?';
};

/**
 * The desk, from the drop-off day: how each pet's arrival went, then one "finish check-in" for
 * the booking that says exactly what it will charge.
 */
export function ArrivalPanel({
  booking,
  petsOfBooking,
  showFinish,
  isBusy,
  canTurnAway,
  onRecordArrival,
  onFinishCheckIn,
}: ArrivalPanelProps): ReactElement {
  const current = booking.booking.check_in_outcome;
  const amount = amountDueAtDesk(petsOfBooking);
  const cardFailed = booking.booking.card_guarantee?.status === 'failed';
  const outcomes = CHECK_IN_OUTCOMES.filter(
    (outcome) => canTurnAway || outcome !== TURNED_AWAY || current === outcome,
  );

  const finish = (): void => {
    if (amount !== null && window.confirm(confirmText(amount, cardFailed))) {
      onFinishCheckIn(booking.booking_id);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border-soft pt-3">
      <div>
        <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
          Arrival
        </p>
        <div
          role="group"
          aria-label={`Arrival of ${booking.pet.name}`}
          className="mt-1.5 flex flex-wrap gap-2"
        >
          {outcomes.map((outcome) => {
            const chosen = current === outcome;
            return (
              <button
                key={outcome}
                type="button"
                aria-pressed={chosen}
                disabled={isBusy || (outcome === TURNED_AWAY && !canTurnAway)}
                onClick={() => onRecordArrival(booking.booking_pets_uuid, outcome)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                  chosen
                    ? 'border-transparent bg-action-dark text-on-action-dark'
                    : 'border-border-soft text-notice-primary hover:bg-surface-cream'
                }`}
              >
                {OUTCOME_LABELS[outcome]}
              </button>
            );
          })}
        </div>
        {/* The Code of Welfare lets an unvaccinated pet stay in isolation; the terms charge no fee. */}
        <p className="mt-1.5 type-meta text-notice-secondary">
          No vaccination proof? Choose Checked in and keep the pet apart from other pets. There is
          no fee for this.
        </p>
      </div>

      {showFinish &&
        (amount === null ? (
          <p className="type-meta text-notice-secondary">
            Record every pet on this booking, then finish check-in.
          </p>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={finish}
            className="rounded-lg bg-action-dark px-4 py-2 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark-hover disabled:opacity-50"
          >
            {finishLabel(amount, cardFailed)}
          </button>
        ))}
    </div>
  );
}
