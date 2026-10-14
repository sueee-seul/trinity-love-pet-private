import { useState, type ReactElement } from 'react';
import { DateField } from '../../../../shared/components/ui/date';
import type { StaffReschedule } from '../../types/booking';
import { addDays, aucklandDateOf } from '../../utils/bookingDesk';

interface ExceptionRescheduleProps {
  bookingId: string;
  /** The stay's current drop-off (ISO), to start from. */
  dropOffAt: string | null;
  isBusy: boolean;
  onMove: (bookingId: string, change: StaffReschedule) => void;
}

const MIN_REASON_LENGTH = 3;

/**
 * Moves the whole stay to new dates without a charge, for the exceptions in the booking terms. It
 * does not use the guest's own free change; the reason is kept for every manager.
 */
export function ExceptionReschedule({
  bookingId,
  dropOffAt,
  isBusy,
  onMove,
}: ExceptionRescheduleProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(() =>
    dropOffAt ? aucklandDateOf(new Date(dropOffAt)) : '',
  );
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const today = aucklandDateOf(new Date());
  const ready =
    startDate !== '' && endDate > startDate && reason.trim().length >= MIN_REASON_LENGTH;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-meta font-semibold text-notice-secondary underline underline-offset-2"
      >
        Move without a charge
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-surface-cream p-3">
      <p className="type-meta text-notice-secondary">
        Only for a civil defence emergency, a MetService red warning, or a pet a vet says is too
        unwell to board. The guest keeps their own free change of dates.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`move-start-${bookingId}`}
            className="block type-meta font-semibold text-notice-primary"
          >
            New drop-off date
          </label>
          <DateField
            id={`move-start-${bookingId}`}
            value={startDate}
            onChange={setStartDate}
            min={today}
            required
          />
        </div>
        <div>
          <label
            htmlFor={`move-end-${bookingId}`}
            className="block type-meta font-semibold text-notice-primary"
          >
            New pick-up date
          </label>
          <DateField
            id={`move-end-${bookingId}`}
            value={endDate}
            onChange={setEndDate}
            min={startDate ? addDays(startDate, 1) : today}
            required
          />
        </div>
      </div>
      <label
        htmlFor={`move-reason-${bookingId}`}
        className="block type-meta font-semibold text-notice-primary"
      >
        Why is this stay moved without a charge?
      </label>
      <textarea
        id={`move-reason-${bookingId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-field-border px-3 py-2 type-meta"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy || !ready}
          onClick={() => {
            onMove(bookingId, { startDate, endDate, reason: reason.trim() });
            setOpen(false);
          }}
          className="rounded-lg bg-action-dark px-4 py-2 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark-hover disabled:opacity-50"
        >
          Move stay
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 type-meta font-semibold text-notice-secondary hover:bg-surface-cream"
        >
          Keep dates
        </button>
      </div>
    </div>
  );
}
