import { useState, type ReactElement } from 'react';
import { DateField } from '../../../../shared/components/ui/date';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { extendStay, previewExtension } from '../../api/stayChangesApi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';
import {
  EXTENSION_PRICE_CHANGED,
  type ExtensionPreview,
  type ExtensionResult,
} from '../../types/stayChanges';
import { IN_STAY_CHANGES_COPY } from './inStayChangesCopy';
import { StayDialogActions } from './StayDialogActions';
import { StayDialogFrame } from './StayDialogFrame';
import { STAYS_COPY } from './staysCopy';
import {
  addDays,
  aucklandDateOf,
  EXTENSION_WINDOW_DAYS,
  formatDay,
  formatMoney,
  listOfNames,
} from './stayChangeRules';
import {
  DIALOG_ALERT,
  DIALOG_HINT,
  DIALOG_INTRO,
  DIALOG_LABEL,
  DIALOG_SUMMARY,
} from './stayDialogStyles';
import { usePricedChange } from './usePricedChange';

interface ExtendStayDialogProps {
  stay: PetStay;
  /** Every pet on the booking: the extension adds the nights for all of them. */
  petNames: string[];
  onClose: () => void;
  onExtended: (result: ExtensionResult) => void;
}

/** Adds nights to a stay under way at the rates booked, after showing what they cost. */
export function ExtendStayDialog({
  stay,
  petNames,
  onClose,
  onExtended,
}: ExtendStayDialogProps): ReactElement {
  const locale = usePortalLocale();
  const { extend: copy, shared } = usePortalCopy(IN_STAY_CHANGES_COPY);
  const { nights: nightsText } = usePortalCopy(STAYS_COPY).shared;
  const currentEnd = aucklandDateOf(stay.pickUpAt);
  const [endDate, setEndDate] = useState(() => addDays(currentEnd, 1));
  const change = usePricedChange<ExtensionPreview, ExtensionResult>({
    preview: () => previewExtension(stay.bookingId, endDate),
    apply: (preview) => extendStay(stay.bookingId, { endDate, expectedAmount: preview.amount }),
    onApplied: onExtended,
    changedCode: EXTENSION_PRICE_CHANGED,
    withNewAmount: (preview, amount) => ({ ...preview, amount }),
    copy: {
      amountChanged: shared.amountChanged,
      checkFailed: copy.checkFailed,
      applyFailed: copy.extendFailed,
    },
  });
  const { preview } = change;

  const confirmLabel = (found: ExtensionPreview): string =>
    found.settlement === 'desk'
      ? copy.confirmToBill(formatMoney(found.amount))
      : copy.confirm(formatMoney(found.amount));

  const pickEnd = (value: string): void => {
    setEndDate(value);
    change.reset();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <StayDialogFrame titleId="extend-stay-title" title={copy.title} onClose={onClose}>
        <p className={DIALOG_INTRO}>
          {copy.intro(listOfNames(petNames, locale), formatDay(currentEnd, locale))}
        </p>
        <div className="mt-4">
          <label htmlFor="extend-pick-up" className={DIALOG_LABEL}>
            {copy.newCheckOut}
          </label>
          <DateField
            id="extend-pick-up"
            value={endDate}
            onChange={pickEnd}
            min={addDays(currentEnd, 1)}
            max={addDays(currentEnd, EXTENSION_WINDOW_DAYS)}
            locale={locale}
            required
          />
          <p className={DIALOG_HINT}>{copy.longest(EXTENSION_WINDOW_DAYS)}</p>
        </div>

        {preview && (
          <div role="status" className={DIALOG_SUMMARY}>
            <p className="m-0 font-semibold text-notice-primary">
              {copy.summary(
                formatDay(preview.newEndDate, locale),
                nightsText(preview.addedNights),
                formatMoney(preview.amount),
              )}
            </p>
            {preview.pets.length > 1 && (
              <ul className="m-0 mt-1 list-none p-0 text-notice-secondary">
                {preview.pets.map((line) => (
                  <li key={line.bookingPetId}>
                    {copy.petLine(
                      line.petName,
                      nightsText(preview.addedNights),
                      formatMoney(line.nightlyRate),
                      formatMoney(line.amount),
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 mt-1 text-notice-secondary">
              {preview.settlement === 'desk' ? shared.addedToBill : shared.chargedNow}
            </p>
          </div>
        )}
        {change.problem && (
          <p role="alert" className={DIALOG_ALERT}>
            {change.problem}
          </p>
        )}

        <StayDialogActions
          keepLabel={shared.keep}
          onKeep={onClose}
          actionLabel={preview ? confirmLabel(preview) : copy.check}
          onAction={() => void (preview ? change.confirm() : change.check())}
          actionDisabled={change.checking || change.sending}
        />
      </StayDialogFrame>
    </Modal>
  );
}
