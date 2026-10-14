import { useState, type ReactElement } from 'react';
import { DateField } from '../../../../shared/components/ui/date';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { previewReschedule, rescheduleStay } from '../../api/stayChangesApi';
import { usePortalCopy, usePortalLocale, type PortalLocale } from '../../i18n/portalLocale';
import { requestErrorText } from '../../i18n/requestErrorText';
import type { PetStay } from '../../types/stays';
import {
  RESCHEDULE_PRICE_CHANGED,
  type ReschedulePreview,
  type RescheduleResult,
} from '../../types/stayChanges';
import { STAY_CHANGES_COPY, type StayChangesCopy } from './stayChangesCopy';
import { StayDialogFrame } from './StayDialogFrame';
import { STAYS_COPY } from './staysCopy';
import {
  addDays,
  apiErrorCode,
  aucklandDateOf,
  earliestNewDropOff,
  formatDay,
  formatMoney,
  fullNightsOf,
  latestPickUpFor,
  listOfNames,
  MAX_STAY_NIGHTS,
  RESCHEDULE_WINDOW_DAYS,
} from './stayChangeRules';

interface ChangeDatesDialogProps {
  stay: PetStay;
  /** Every pet on the booking: they all move together. */
  petNames: string[];
  onClose: () => void;
  onChanged: (result: RescheduleResult) => void;
  now?: Date;
}

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ready'; preview: ReschedulePreview }
  | { status: 'problem'; message: string };

type MoveCopy = StayChangesCopy['move'];

const problemText = (error: unknown, copy: MoveCopy, locale: PortalLocale): string => {
  const nights = fullNightsOf(error);
  if (nights.length > 0) {
    return copy.fullyBooked(
      listOfNames(
        nights.map((night) => formatDay(night, locale)),
        locale,
      ),
      nights.length,
    );
  }
  return requestErrorText(error, locale, copy.checkFailed, copy.refusals);
};

/** Moves the whole stay to new dates once, at the rates booked, after showing the new price. */
export function ChangeDatesDialog({
  stay,
  petNames,
  onClose,
  onChanged,
  now = new Date(),
}: ChangeDatesDialogProps): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(STAY_CHANGES_COPY).move;
  const { nights: nightsText } = usePortalCopy(STAYS_COPY).shared;
  const today = aucklandDateOf(now);
  // The same bounds the server enforces, so the picker never offers a day it will refuse.
  const earliestStart = earliestNewDropOff(stay, now);
  const [startDate, setStartDate] = useState(() => aucklandDateOf(stay.dropOffAt));
  const [endDate, setEndDate] = useState(() => aucklandDateOf(stay.pickUpAt));
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const [sending, setSending] = useState(false);

  /** A new date means the old price check no longer applies. */
  const pickStart = (value: string): void => {
    setStartDate(value);
    // A later drop-off can push the pick-up past the longest stay; pull it back inside.
    if (endDate > latestPickUpFor(value)) setEndDate(latestPickUpFor(value));
    setCheck({ status: 'idle' });
  };
  const pickEnd = (value: string): void => {
    setEndDate(value);
    setCheck({ status: 'idle' });
  };

  const checkDates = async (): Promise<void> => {
    setCheck({ status: 'checking' });
    try {
      setCheck({
        status: 'ready',
        preview: await previewReschedule(stay.bookingId, { startDate, endDate }),
      });
    } catch (error) {
      setCheck({ status: 'problem', message: problemText(error, copy, locale) });
    }
  };

  // The button moves the stay at the total it showed: the server refuses any other total, and the
  // dialog then asks for a fresh check rather than charging something the guest never saw.
  const confirm = async (): Promise<void> => {
    if (check.status !== 'ready') return;
    setSending(true);
    try {
      onChanged(
        await rescheduleStay(stay.bookingId, {
          startDate,
          endDate,
          expectedTotal: check.preview.total,
        }),
      );
    } catch (error) {
      const message =
        apiErrorCode(error) === RESCHEDULE_PRICE_CHANGED
          ? copy.priceChanged
          : problemText(error, copy, locale);
      setCheck({ status: 'problem', message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <StayDialogFrame titleId="change-dates-title" title={copy.title} onClose={onClose}>
        <p className="m-0 type-body text-notice-secondary">
          {copy.intro(listOfNames(petNames, locale), stay.dateChangesLeft !== null)}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-drop-off" className="type-meta font-semibold text-notice-primary">
              {copy.newDropOff}
            </label>
            <DateField
              id="new-drop-off"
              value={startDate}
              onChange={pickStart}
              min={earliestStart}
              max={addDays(today, RESCHEDULE_WINDOW_DAYS)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-pick-up" className="type-meta font-semibold text-notice-primary">
              {copy.newPickUp}
            </label>
            <DateField
              id="new-pick-up"
              value={endDate}
              onChange={pickEnd}
              min={addDays(startDate, 1)}
              max={latestPickUpFor(startDate)}
              required
            />
            <p className="m-0 mt-1 text-[12px] text-notice-muted">
              {copy.longestStay(MAX_STAY_NIGHTS)}
            </p>
          </div>
        </div>

        {check.status === 'ready' && (
          <div role="status" className="mt-4 rounded-xl bg-surface-cream px-3 py-2.5 type-meta">
            <p className="m-0 font-semibold text-notice-primary">
              {copy.summary(
                formatDay(check.preview.startDate, locale),
                formatDay(check.preview.endDate, locale),
                nightsText(check.preview.nights),
                formatMoney(check.preview.total),
              )}
            </p>
            <p className="m-0 mt-1 text-notice-secondary">
              {check.preview.usesFreeReschedule ? copy.usesFreeChange : ''}
              {check.preview.paysNow ? copy.paidChange : copy.holdReleased}
            </p>
          </div>
        )}
        {check.status === 'problem' && (
          <p role="alert" className="m-0 mt-4 type-button text-status-danger">
            {check.message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-soft px-4 py-2 type-button text-notice-primary hover:bg-surface-cream"
          >
            {copy.keepDates}
          </button>
          {check.status === 'ready' ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => void confirm()}
              className="rounded-full bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark disabled:opacity-50"
            >
              {copy.confirm}
            </button>
          ) : (
            <button
              type="button"
              disabled={check.status === 'checking'}
              onClick={() => void checkDates()}
              className="rounded-full bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark disabled:opacity-50"
            >
              {copy.check}
            </button>
          )}
        </div>
      </StayDialogFrame>
    </Modal>
  );
}
