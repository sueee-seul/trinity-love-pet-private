import { useState, type ReactElement } from 'react';

interface ExceptionCancelProps {
  bookingId: string;
  isBusy: boolean;
  onCancel: (bookingId: string, reason: string) => void;
}

const MIN_REASON_LENGTH = 3;

/**
 * Cancels the whole booking without a fee, for the exceptions in the booking terms: a civil
 * defence emergency, a MetService red warning, or a pet a vet says is too unwell to board.
 */
export function ExceptionCancel({
  bookingId,
  isBusy,
  onCancel,
}: ExceptionCancelProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const fieldId = `no-fee-reason-${bookingId}`;

  const close = (): void => {
    setOpen(false);
    setReason('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-meta font-semibold text-notice-secondary underline underline-offset-2"
      >
        Cancel without a fee
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-surface-cream p-3">
      <label htmlFor={fieldId} className="block type-meta font-semibold text-notice-primary">
        Why is this booking cancelled without a fee?
      </label>
      <p className="type-meta text-notice-secondary">
        Only for a civil defence emergency, a MetService red warning, or a pet a vet says is too
        unwell to board. Every pet on the booking is cancelled and the card hold is released in
        full.
      </p>
      <textarea
        id={fieldId}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-field-border px-3 py-2 type-meta"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy || reason.trim().length < MIN_REASON_LENGTH}
          onClick={() => {
            onCancel(bookingId, reason.trim());
            close();
          }}
          className="rounded-lg bg-status-danger px-4 py-2 type-meta font-semibold text-white transition hover:bg-status-danger disabled:opacity-50"
        >
          Cancel booking, no fee
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-lg px-4 py-2 type-meta font-semibold text-notice-secondary hover:bg-surface-cream"
        >
          Keep booking
        </button>
      </div>
    </div>
  );
}
