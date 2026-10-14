import type {
  ConciergeCardSetupRequest,
  ConciergeCardSetupResponse,
} from '../../contracts/concierge.contract.js';
import { assertEmailIsNew } from './concierge.checkout-checks.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import type { CardProcessor } from '../payments/card-processor.js';
import { verifyAcceptedQuote, verifyVerifiedEmail } from './concierge.tokens.js';

/**
 * The card that guarantees a concierge booking.
 *
 * The details step asks for a card setup tied to the accepted quote; the page confirms it with the
 * processor in the browser (card details never reach this server); checkout then checks that the
 * setup succeeded and was made for this very acceptance. A booking whose drop-off is less than 48
 * hours away is held at checkout; the rest are held later by the reminder job.
 */

export interface CardSetupIdentity {
  /** The signed-in pet owner's email; a guest proves their email with a verification token. */
  signedInEmail?: string | undefined;
}

/**
 * A first-time guest's email, accepted only while it has no account: the card is saved to a
 * customer of that address, so it must never land beside an existing parent's cards.
 */
const guestEmailFor = async (request: ConciergeCardSetupRequest): Promise<string | null> => {
  if (!request.guestEmail) return null;
  await assertEmailIsNew(request.guestEmail);
  return request.guestEmail;
};

export const createConciergeCardSetup = async (
  request: ConciergeCardSetupRequest,
  identity: CardSetupIdentity,
  processor: CardProcessor,
): Promise<ConciergeCardSetupResponse> => {
  const { acceptanceId } = await verifyAcceptedQuote(request.acceptedQuoteToken);
  const email =
    identity.signedInEmail ??
    (request.verificationToken ? await verifyVerifiedEmail(request.verificationToken) : null) ??
    (await guestEmailFor(request));
  if (!email) {
    throw new AppError(
      'Please sign in, or enter your email, before adding a card.',
      'CONCIERGE_EMAIL_UNVERIFIED',
      401,
    );
  }
  const setup = await processor.createCardSetup({ email, acceptanceId });
  return {
    processor: processor.name,
    setupId: setup.setupId,
    clientSecret: setup.clientSecret,
    publishableKey: processor.publishableKey,
    testMode: processor.testMode,
  };
};

/** The saved card's payment method, once its setup is confirmed for this acceptance. */
export const readGuaranteeCard = async (
  processor: CardProcessor,
  setupId: string,
  acceptanceId: string,
): Promise<{ paymentMethodId: string }> => {
  const setup = await processor.readCardSetup(setupId);
  if (setup.acceptanceId !== acceptanceId) {
    throw new AppError(
      'This card was saved for a different booking. Please add your card again.',
      'CONCIERGE_CARD_MISMATCH',
      409,
    );
  }
  if (setup.status !== 'succeeded' || !setup.paymentMethodId) {
    throw new AppError(
      'Your card is not confirmed yet. Please add it again.',
      'CONCIERGE_CARD_NOT_READY',
      409,
    );
  }
  return { paymentMethodId: setup.paymentMethodId };
};
