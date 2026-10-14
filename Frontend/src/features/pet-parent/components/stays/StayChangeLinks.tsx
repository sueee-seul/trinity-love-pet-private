import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';
import { IN_STAY_CHANGES_COPY } from './inStayChangesCopy';
import { STAYS_COPY } from './staysCopy';
import {
  canAddOn,
  canCancelOnline,
  canChangeTimes,
  canExtendOnline,
  canMoveOnline,
} from './stayChangeRules';

/** What a page offers to change on a stay; a handler left out means that change is not offered. */
export interface StayChangeHandlers {
  onCancel?: (stay: PetStay) => void;
  onChangeDates?: (stay: PetStay) => void;
  onExtend?: (stay: PetStay) => void;
  onAddOn?: (stay: PetStay) => void;
  onChangeTimes?: (stay: PetStay) => void;
}

interface StayChangeLinksProps extends StayChangeHandlers {
  stay: PetStay;
  now?: Date;
}

interface ChangeLink {
  label: string;
  onClick: (stay: PetStay) => void;
  danger?: boolean;
}

const LINK = 'type-button min-h-11 underline underline-offset-2';

/**
 * The underline links that change a stay, as the card and the booking details both show them. The
 * rules in stayChangeRules decide which apply: before check-in the dates, the check-in time and
 * cancelling; while the pet is in, more nights, an add-on and the check-out time.
 */
export function StayChangeLinks({
  stay,
  now = new Date(),
  onCancel,
  onChangeDates,
  onExtend,
  onAddOn,
  onChangeTimes,
}: StayChangeLinksProps): ReactElement | null {
  const { card: copy } = usePortalCopy(STAYS_COPY);
  const { links } = usePortalCopy(IN_STAY_CHANGES_COPY);
  // A link only when the page offers the change and the rules allow it for this stay now.
  const link = (
    handler: ((stay: PetStay) => void) | undefined,
    allowed: boolean,
    label: string,
    danger = false,
  ): ChangeLink[] => (handler && allowed ? [{ label, onClick: handler, danger }] : []);
  const timesLink = (status: PetStay['status']): ChangeLink[] =>
    stay.status === status ? link(onChangeTimes, canChangeTimes(stay, now), links.changeTimes) : [];

  const beforeDropOff: ChangeLink[] = [
    ...link(onChangeDates, canMoveOnline(stay, now), copy.changeDates),
    ...timesLink('approved'),
    ...link(
      onCancel,
      canCancelOnline(stay, now),
      stay.status === 'waiting_for_review' ? copy.withdrawRequest : copy.cancelStay,
      true,
    ),
  ];
  const underWay: ChangeLink[] = [
    ...link(onExtend, canExtendOnline(stay, now), links.extend),
    ...link(onAddOn, canAddOn(stay, now), links.addOn),
    ...timesLink('staying_now'),
  ];
  const rows = [beforeDropOff, underWay].filter((row) => row.length > 0);
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <div key={row[0]?.label} className="mt-3 flex flex-wrap justify-end gap-4">
          {row.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={(): void => link.onClick(stay)}
              className={`${LINK} ${link.danger ? 'text-status-danger' : 'text-notice-primary'}`}
            >
              {link.label}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
