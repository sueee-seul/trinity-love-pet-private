import React from 'react';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeLocale } from '../../types';
import { formatDateList } from '../../utils/format';
import { SURFACE_CARD } from '../conciergeStyles';

interface FullyBookedNoticeProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  fullNights: string[];
  /** Why the guest is back here, e.g. the last place went while they were booking. */
  notice: string | null;
}

/**
 * Shown where the options would be when some nights have no room. Booking is instant, so options
 * that could not be booked are never offered; the guest is told which nights to move instead.
 */
export const FullyBookedNotice: React.FC<FullyBookedNoticeProps> = ({
  copy,
  locale,
  fullNights,
  notice,
}) => (
  <section
    id="concierge-fully-booked"
    role="status"
    aria-labelledby="concierge-fully-booked-title"
    className={`${SURFACE_CARD} scroll-mt-4 p-5 sm:p-7`}
  >
    <h2
      id="concierge-fully-booked-title"
      className="m-0 font-agbalumo text-[22px] font-normal leading-7 text-notice-primary"
    >
      {copy.packages.fullyBookedTitle}
    </h2>
    {notice && (
      <p className="mb-0 mt-2 font-inter text-[15px] font-semibold leading-6 text-notice-primary">
        {notice}
      </p>
    )}
    <p className="mb-0 mt-2 font-inter text-[15px] leading-6 text-notice-secondary">
      {copy.packages.fullyBooked(formatDateList(fullNights, locale))}
    </p>
  </section>
);
