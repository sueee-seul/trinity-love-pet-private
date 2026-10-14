import type { ReactElement } from 'react';
import { DIALOG_PRIMARY_BUTTON, DIALOG_SECONDARY_BUTTON } from './stayDialogStyles';

interface StayDialogActionsProps {
  /** The way out that changes nothing, named by what it keeps. */
  keepLabel: string;
  onKeep: () => void;
  /** The button that acts, named by its result. */
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}

/** The two buttons at the foot of a stay dialog: keep things as they are, or make the change. */
export function StayDialogActions({
  keepLabel,
  onKeep,
  actionLabel,
  onAction,
  actionDisabled = false,
}: StayDialogActionsProps): ReactElement {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onKeep} className={DIALOG_SECONDARY_BUTTON}>
        {keepLabel}
      </button>
      <button
        type="button"
        disabled={actionDisabled}
        onClick={onAction}
        className={DIALOG_PRIMARY_BUTTON}
      >
        {actionLabel}
      </button>
    </div>
  );
}
