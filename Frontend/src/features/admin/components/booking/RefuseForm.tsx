import { useId, useState, type ReactElement } from 'react';
import {
  REFUSAL_REASON_IDS,
  REFUSAL_REASONS,
  type RefusalReasonId,
} from '../../../../shared/booking/refusalReasons';

interface RefuseFormProps {
  /** Shown when refusing this pet ends the booking and releases the card hold. */
  releasesHold: boolean;
  isBusy: boolean;
  onRefuse: (reason: string) => void;
  onCancel: () => void;
}

/**
 * The reason a manager gives for refusing a stay, picked from the preset list. The parent reads it
 * in their own language, which free text could not offer; anything the list does not cover is
 * "Please contact us", and the conversation happens with a person.
 */
export function RefuseForm({
  releasesHold,
  isBusy,
  onRefuse,
  onCancel,
}: RefuseFormProps): ReactElement {
  const [reason, setReason] = useState<RefusalReasonId | null>(null);
  const groupName = useId();

  return (
    <div className="space-y-2">
      <fieldset className="m-0 space-y-1 border-0 p-0">
        <legend className="mb-1 type-meta font-semibold text-notice-primary">
          Reason for refusing this booking
        </legend>
        {REFUSAL_REASON_IDS.map((id) => (
          <label key={id} className="flex items-start gap-2 type-meta text-notice-primary">
            <input
              type="radio"
              name={groupName}
              value={id}
              checked={reason === id}
              onChange={() => setReason(id)}
              className="mt-0.5"
            />
            {REFUSAL_REASONS.en[id]}
          </label>
        ))}
      </fieldset>
      {releasesHold && (
        <p className="type-meta text-notice-secondary">
          Refusing the last pet on this booking releases the card hold in full.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy || reason === null}
          onClick={() => {
            if (reason) onRefuse(REFUSAL_REASONS.en[reason]);
          }}
          className="rounded-lg bg-status-danger px-4 py-2 type-meta font-semibold text-white transition hover:bg-status-danger disabled:opacity-50"
        >
          Confirm refuse
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 type-meta font-semibold text-notice-secondary hover:bg-surface-cream"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
