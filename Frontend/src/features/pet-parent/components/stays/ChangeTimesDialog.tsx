import { useState, type ReactElement } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { changeStayTimes } from '../../api/stayChangesApi';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';
import type { ChangeTimesInput, ChangeTimesResult } from '../../types/stayChanges';
import { IN_STAY_CHANGES_COPY } from './inStayChangesCopy';
import { StayDialogActions } from './StayDialogActions';
import { StayDialogFrame } from './StayDialogFrame';
import { aucklandClockOf, problemMessage } from './stayChangeRules';
import {
  DIALOG_ALERT,
  DIALOG_HINT,
  DIALOG_INPUT,
  DIALOG_INTRO,
  DIALOG_LABEL,
} from './stayDialogStyles';

interface ChangeTimesDialogProps {
  stay: PetStay;
  onClose: () => void;
  onChanged: (result: ChangeTimesResult) => void;
}

/** Moves the drop-off time (before the stay starts) or the pick-up time, on the booked days. */
export function ChangeTimesDialog({
  stay,
  onClose,
  onChanged,
}: ChangeTimesDialogProps): ReactElement {
  const { times: copy, shared } = usePortalCopy(IN_STAY_CHANGES_COPY);
  // Once the pet is in, the drop-off has happened: only the pick-up time can still move.
  const offersDropOff = stay.status === 'approved';
  const bookedDropOff = aucklandClockOf(stay.dropOffAt);
  const bookedPickUp = aucklandClockOf(stay.pickUpAt);
  const [dropOffTime, setDropOffTime] = useState(bookedDropOff);
  const [pickUpTime, setPickUpTime] = useState(bookedPickUp);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Only the times that moved are sent, so the server leaves the other as booked.
  const input: ChangeTimesInput = {
    ...(offersDropOff && dropOffTime !== '' && dropOffTime !== bookedDropOff
      ? { dropOffTime }
      : {}),
    ...(pickUpTime !== '' && pickUpTime !== bookedPickUp ? { pickUpTime } : {}),
  };
  const nothingChanged = Object.keys(input).length === 0;

  const confirm = async (): Promise<void> => {
    setSending(true);
    setProblem(null);
    try {
      onChanged(await changeStayTimes(stay.bookingId, stay.bookingPetId, input));
    } catch (error) {
      setProblem(problemMessage(error, copy.changeFailed));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <StayDialogFrame titleId="change-times-title" title={copy.title} onClose={onClose}>
        <p className={DIALOG_INTRO}>{copy.intro(stay.pet.name)}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {offersDropOff && (
            <div>
              <label htmlFor="change-drop-off-time" className={DIALOG_LABEL}>
                {copy.checkInTime}
              </label>
              <input
                id="change-drop-off-time"
                type="time"
                value={dropOffTime}
                onChange={(event) => setDropOffTime(event.target.value)}
                className={DIALOG_INPUT}
              />
            </div>
          )}
          <div>
            <label htmlFor="change-pick-up-time" className={DIALOG_LABEL}>
              {copy.checkOutTime}
            </label>
            <input
              id="change-pick-up-time"
              type="time"
              value={pickUpTime}
              onChange={(event) => setPickUpTime(event.target.value)}
              className={DIALOG_INPUT}
            />
          </div>
        </div>
        <p className={DIALOG_HINT}>{copy.noCharge}</p>
        {problem && (
          <p role="alert" className={DIALOG_ALERT}>
            {problem}
          </p>
        )}

        <StayDialogActions
          keepLabel={shared.keep}
          onKeep={onClose}
          actionLabel={copy.confirm}
          onAction={() => void confirm()}
          actionDisabled={nothingChanged || sending}
        />
      </StayDialogFrame>
    </Modal>
  );
}
