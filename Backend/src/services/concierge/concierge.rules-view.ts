import { BOOKING_POLICY } from '../booking.fee-policy.js';
import { getConciergeTerms } from './concierge.terms.js';

/**
 * What the model may read when a guest asks about cancelling, fees, holds, vaccination or any other
 * rule: the fee numbers the server charges by and the current booking terms, as text. A policy
 * answer is only ever a quote from this; the model has nothing else to say about rules. When the
 * terms cannot be read the text says so, and the model is told to send the guest to the team.
 */
export const describeBookingRules = async (): Promise<string> => {
  const freeDays = BOOKING_POLICY.freeCancellationHours / 24;
  const fees = [
    `Free cancellation until ${freeDays} days before check-in.`,
    `Between ${freeDays} days and ${BOOKING_POLICY.shortNoticeHours} hours before check-in the fee is the first night's daily services for each pet, never more than half the pet's price.`,
    `Under ${BOOKING_POLICY.shortNoticeHours} hours before check-in, and for a no-show, the fee is ${BOOKING_POLICY.shortNoticeFeePercent}% of the pet's price.`,
    `A request is reviewed within ${BOOKING_POLICY.reviewWindowHours} hours; a pet that is not accepted is not charged.`,
  ].join('\n');
  const heading = 'Fee rules (the same numbers the server charges by):';
  try {
    const terms = await getConciergeTerms();
    return `${heading}\n${fees}\n\nBooking terms, version ${terms.version} (the text the guest agrees to):\n${terms.content}`;
  } catch {
    return `${heading}\n${fees}\n\nThe full booking terms could not be read right now; for anything beyond these fee rules, send the guest to our team.`;
  }
};
