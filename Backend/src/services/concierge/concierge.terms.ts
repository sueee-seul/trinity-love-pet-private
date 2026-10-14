import type { ConciergeTermsResponse } from '../../contracts/concierge.contract.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import {
  BOOKING_TERMS_VERSION,
  readCurrentAgreementTerms,
} from '../../repositories/booking.agreement.repository.js';

/**
 * The whole booking terms, so a guest can read every clause before ticking the box, not only the
 * summary beside it. Checkout accepts this version only; if its row is missing nobody can book,
 * and the page says the terms are unavailable rather than showing a different version.
 */
export const getConciergeTerms = async (): Promise<ConciergeTermsResponse> => {
  const content = await readCurrentAgreementTerms();
  if (!content) {
    throw new AppError(
      'The booking terms are not available right now. Please try again shortly.',
      'TERMS_UNAVAILABLE',
      503,
    );
  }
  return { version: BOOKING_TERMS_VERSION, content };
};
