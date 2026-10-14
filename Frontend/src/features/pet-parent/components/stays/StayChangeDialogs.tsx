import type { ReactElement } from 'react';
import { AddOnDialog } from './AddOnDialog';
import { CancelStayDialog } from './CancelStayDialog';
import { ChangeDatesDialog } from './ChangeDatesDialog';
import { ChangeTimesDialog } from './ChangeTimesDialog';
import { ExtendStayDialog } from './ExtendStayDialog';
import type { StayChangeNotice } from './stayChangeNotice';
import { isPaid } from './stayChangeRules';
import type { OpenStayDialog } from './stayDialogs';

interface StayChangeDialogsProps {
  dialog: OpenStayDialog | null;
  /** Every pet still on the booking, for the changes that cover the whole booking. */
  petNames: string[];
  onClose: () => void;
  onChanged: (notice: StayChangeNotice) => void;
}

/** Renders whichever stay dialog is open, and turns its result into the page notice. */
export function StayChangeDialogs({
  dialog,
  petNames,
  onClose,
  onChanged,
}: StayChangeDialogsProps): ReactElement | null {
  if (!dialog) return null;
  const { stay } = dialog;
  switch (dialog.kind) {
    case 'cancel':
      return (
        <CancelStayDialog
          stay={stay}
          petNames={petNames}
          onClose={onClose}
          onCancelled={(result) => onChanged({ kind: 'cancelled', result, paid: isPaid(stay) })}
        />
      );
    case 'move':
      return (
        <ChangeDatesDialog
          stay={stay}
          petNames={petNames}
          onClose={onClose}
          onChanged={(result) => onChanged({ kind: 'moved', result })}
        />
      );
    case 'extend':
      return (
        <ExtendStayDialog
          stay={stay}
          petNames={petNames}
          onClose={onClose}
          onExtended={(result) => onChanged({ kind: 'extended', result })}
        />
      );
    case 'add-on':
      return (
        <AddOnDialog
          stay={stay}
          onClose={onClose}
          onAdded={(result) => onChanged({ kind: 'add_on', result })}
        />
      );
    case 'times':
      return (
        <ChangeTimesDialog
          stay={stay}
          onClose={onClose}
          onChanged={(result) => onChanged({ kind: 'times', result })}
        />
      );
  }
}
