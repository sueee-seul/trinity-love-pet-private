import type { ReactElement } from 'react';
import { serviceNameText } from '../../../concierge/utils/serviceNames';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { ManagerReasonText } from './ManagerReasonText';
import type { GetReadyTask } from '../../types/getReady';
import type { PetStay } from '../../types/stays';
import { GetReadyTaskList } from '../get-ready/GetReadyTaskList';
import { getReadyButtonLabel, getReadyTargetOf } from '../get-ready/getReadyTasks';
import { PetAvatarCircle } from '../home/PetAvatarCircle';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_TITLE } from '../home/homeStyles';
import { StatusBadge } from './StatusBadge';
import { StayPaymentNote } from './StayPaymentNote';
import { formatDateRange } from './formatStayDate';
import { STAYS_COPY, type StaysCopy } from './staysCopy';
import { StayChangeLinks, type StayChangeHandlers } from './StayChangeLinks';
import { canViewCare, stayTab } from './stayStatus';
import { CalendarIcon, ChevronRightIcon, ClockIcon } from './icons';

/** Each change handler opens its dialog; one left out means the card does not offer that change. */
interface PetStayCardProps extends StayChangeHandlers {
  stay: PetStay;
  onViewCare: (bookingPetId: string) => void;
  onViewBookingDetails: (bookingPetId: string) => void;
  now?: Date;
}

/** What the card says in place of "View live care" while there is nothing to watch yet. A refused
 * or cancelled request never gets live care, so it says nothing about it; nor does a request whose
 * dates passed while it waited for review, since that stay can no longer start. */
function liveCareNote(stay: PetStay, copy: StaysCopy['card']): string | null {
  if (stay.status === 'approved') {
    return copy.liveCareWhenArrives(stay.pet.name);
  }
  if (stay.status === 'waiting_for_review' && stayTab(stay) === 'upcoming') {
    return copy.liveCareWhenApproved(stay.pet.name);
  }
  return null;
}

/** "Get ready, 2 of 4 done": opens the tasks inside the card, so each one is a tap away. */
function GetReadyDisclosure({
  stay,
  tasks,
}: {
  stay: PetStay;
  tasks: GetReadyTask[];
}): ReactElement {
  const locale = usePortalLocale();
  return (
    <details className="group mt-4 rounded-xl border border-border-soft bg-surface-cream/50">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 type-button text-notice-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
        {getReadyButtonLabel(tasks, locale)}
        <ChevronRightIcon className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-3 pb-4 sm:px-4">
        <GetReadyTaskList tasks={tasks} target={getReadyTargetOf(stay)} />
      </div>
    </details>
  );
}

/** One card per pet stay (one `booking_pets` row). Even when the pet
 * shared a booking with another pet, each gets its own card with its own
 * dates, total and manager decision. */
export function PetStayCard({
  stay,
  onViewCare,
  onViewBookingDetails,
  now = new Date(),
  ...changeHandlers
}: PetStayCardProps): ReactElement {
  const { shared, card: copy } = usePortalCopy(STAYS_COPY);
  const locale = usePortalLocale();
  const viewCareEnabled = canViewCare(stay);
  const note = liveCareNote(stay, copy);
  const titleId = `stay-${stay.bookingPetId}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-2xl border border-border-soft bg-surface-card p-4 shadow-card sm:p-5"
    >
      {/* Wraps on a phone, so the badge drops under the pet instead of squeezing its dates. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Decorative beside the name, so a screen reader does not read the initial first. */}
          <span aria-hidden="true">
            <PetAvatarCircle
              name={stay.pet.name}
              photoUrl={stay.pet.photoUrl}
              sizeClass="h-12 w-12 text-body"
            />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className={SECTION_TITLE}>
              {stay.pet.name}
            </h2>
            <p className="type-meta m-0 mt-1 flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {formatDateRange(stay.dropOffAt, stay.pickUpAt, locale)}
            </p>
            <p className="type-meta m-0 mt-0.5 flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 shrink-0" />
              {shared.nights(stay.nights)} · {serviceNameText(stay.serviceType, locale)}
            </p>
          </div>
        </div>
        <StatusBadge status={stay.status} />
      </div>

      {stay.status === 'refused' && stay.refusalReason && (
        <p className="type-body m-0 mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-notice-primary">
          <ManagerReasonText
            reason={stay.refusalReason}
            sentence={(reason) => copy.managerSaid(reason, stay.reviewerName)}
          />
        </p>
      )}

      {stay.status !== 'refused' && stay.reviewerName && (
        <p className="type-meta m-0 mt-4 text-notice-secondary">
          {copy.confirmedBy(stay.reviewerName)}
        </p>
      )}

      <StayPaymentNote stay={stay} />

      {stay.getReady && <GetReadyDisclosure stay={stay} tasks={stay.getReady} />}

      <div className="mt-4 flex flex-col gap-4 border-t border-border-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-meta m-0">{shared.total}</p>
          <p className="m-0 font-fraunces text-card-title font-bold text-notice-primary">
            ${stay.total.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={(): void => onViewBookingDetails(stay.bookingPetId)}
            className={SECONDARY_BUTTON}
          >
            {copy.bookingDetails}
          </button>
          {viewCareEnabled && (
            <button
              type="button"
              onClick={(): void => onViewCare(stay.bookingPetId)}
              className={`${stay.status === 'staying_now' ? PRIMARY_BUTTON : SECONDARY_BUTTON} gap-1`}
            >
              {copy.viewLiveCare}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Before drop-off there is nothing to watch yet, so say when there will be rather than
          showing a button that cannot be used. */}
      {note && <p className="type-meta m-0 mt-3">{note}</p>}

      <StayChangeLinks stay={stay} now={now} {...changeHandlers} />
    </article>
  );
}
