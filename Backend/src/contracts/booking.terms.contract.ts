/**
 * Booking terms versions. A booking keeps the rules of the version it agreed to, so the money and
 * change rules read the version label ("concierge-terms-YYYY-MM-DD"), which sorts by date.
 */

/** Version of the reviewed terms shown by this release; mirrored by the checkout UI. */
export const BOOKING_TERMS_VERSION = 'concierge-terms-2026-10-07';

/**
 * The first version whose clause 8 lets a parent extend, shorten or add to a stay under way from
 * My Stays, charged or refunded on the saved card at the amount shown first.
 */
export const IN_STAY_CHANGES_TERMS_VERSION = 'concierge-terms-2026-10-07';

/**
 * The first version that holds the price when the request is sent and charges it on confirmation.
 * Bookings agreed under an earlier version keep the 48-hour hold and the charge at the desk.
 */
export const PAY_AT_REQUEST_TERMS_VERSION = 'concierge-terms-2026-10-02';

/**
 * The first version with three fee tiers and nothing else: no grace or cooling-off window, dates
 * changed as often as needed before drop-off, and no fee for a pet that arrives without proof of
 * vaccination.
 */
export const SIMPLE_CHANGES_TERMS_VERSION = 'concierge-terms-2026-10-06';
