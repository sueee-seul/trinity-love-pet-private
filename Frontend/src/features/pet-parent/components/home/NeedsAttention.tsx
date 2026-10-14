import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { RefusedRequest } from '../../types/home';
import { formatCompactRange } from '../../utils/home';
import { StatusBadge } from '../stays/StatusBadge';
import { HOME_COPY } from './homeCopy';
import { GROUPED_CARD, SECONDARY_BUTTON, SECTION_TITLE } from './homeStyles';
import { ManagerReasonText } from '../stays/ManagerReasonText';

const BOOKING = '/parent/booking';

// A request the manager refused while its dates are still ahead. The parent can still act on it
// by choosing other dates, so Home names it, gives the manager's reason and offers the booking.
function RefusedRequestRow({ request }: { request: RefusedRequest }): ReactElement {
  const copy = usePortalCopy(HOME_COPY);
  const locale = usePortalLocale();
  return (
    <li className="flex flex-col gap-3 border-b border-border-soft px-4 py-4 last:border-b-0 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="type-body m-0 font-bold text-notice-primary">
          {copy.refusedRowTitle(
            request.petName,
            formatCompactRange(request.dropOffAt, request.pickUpAt, locale),
          )}
        </p>
        <StatusBadge status="refused" />
      </div>
      <p className="type-body m-0 text-notice-secondary">
        {request.refusalReason ? (
          <ManagerReasonText
            reason={request.refusalReason}
            sentence={(reason) => copy.managerSaid(reason, request.reviewerName)}
          />
        ) : (
          copy.managerRefused(request.reviewerName)
        )}
      </p>
      {/* The visible words start the name, so a voice user can still say "Try other dates". */}
      <Link
        to={BOOKING}
        aria-label={copy.tryOtherDatesFor(request.petName)}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {copy.tryOtherDates}
      </Link>
    </li>
  );
}

export function NeedsAttention({ requests }: { requests: RefusedRequest[] }): ReactElement | null {
  const copy = usePortalCopy(HOME_COPY);
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="needs-attention" className="flex flex-col gap-3">
      <h2 id="needs-attention" className={SECTION_TITLE}>
        {copy.needsAttention}
      </h2>
      <ul className={`${GROUPED_CARD} m-0 list-none p-0`}>
        {requests.map((request) => (
          <RefusedRequestRow key={request.bookingPetId} request={request} />
        ))}
      </ul>
    </section>
  );
}
