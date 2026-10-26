import type { NextFunction, Request, Response } from 'express';
import {
  conciergeAcceptQuoteSchema,
  conciergeChatRequestSchema,
  conciergeCheckoutSchema,
  conciergePriceRequestSchema,
  conciergeVerificationConfirmSchema,
  conciergeVerificationStartSchema,
  type ConciergeVerificationResult,
} from '../contracts/concierge.contract.js';
import { loadAuthenticatedUserFromCookieHeader } from '../common/middlewares/auth.middleware.js';
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthSessionCookieOptions,
} from '../services/auth.session.js';
import type { AuthenticatedUser } from '../services/auth.service.js';
import { getServiceCatalog } from '../services/petparent.booking.js';
import {
  acceptConciergeQuote,
  getConciergeLastStay,
  getConciergeRates,
  priceConciergeSelection,
  runConciergeTurn,
} from '../services/concierge/concierge.service.js';
import { checkoutConciergeBooking } from '../services/concierge/concierge.checkout.js';
import {
  getConciergeStatus,
  readCapacityConfigured,
} from '../services/concierge/concierge.status.js';
import { getConciergeTerms } from '../services/concierge/concierge.terms.js';
import {
  canBookAsPetOwner,
  confirmEmailAndResolveIdentity,
  startEmailVerification,
} from '../services/concierge/concierge.identity.js';

/**
 * Transport for the public booking concierge. Every handler validates its body with the contract
 * schema, calls one service, and shapes the response; no business rule lives here.
 */

/** A stale or tampered cookie is treated as a guest, not as an error, on these public routes. */
const optionalPetOwner = async (req: Request): Promise<AuthenticatedUser | null> => {
  try {
    const user = await loadAuthenticatedUserFromCookieHeader(req.headers.cookie);
    return user && canBookAsPetOwner(user) ? user : null;
  } catch {
    return null;
  }
};

const setSessionCookie = async (res: Response, userId: string): Promise<void> => {
  const token = await createSessionToken(userId);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthSessionCookieOptions());
};

export const getConciergeCatalogue = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Public, read-only: service names and prices only, never anything about a person.
    const services = await getServiceCatalog();
    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
};

/** Public and cacheable: one number worked out from the published catalogue, nothing personal. */
export const getConciergeRatesHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rates = await getConciergeRates();
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json(rates);
  } catch (error) {
    next(error);
  }
};

/** Public and cacheable: the full terms text the checkbox agrees to, nothing personal. */
export const getConciergeTermsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const terms = await getConciergeTerms();
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json(terms);
  } catch (error) {
    next(error);
  }
};

/**
 * Public: tells the page up front whether email codes work, whether a stay can be booked at all
 * (a card processor and a facility capacity exist) and how to reach a person.
 */
export const getConciergeStatusHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set('Cache-Control', 'no-store');
  const capacityConfigured = await readCapacityConfigured();
  res.status(200).json(getConciergeStatus(undefined, undefined, capacityConfigured));
};

export const postConciergeChat = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const request = conciergeChatRequestSchema.parse(req.body);
    // A signed-in parent may ask for "same as last time"; a guest gets the sign-in hint instead.
    const signedIn = await optionalPetOwner(req);
    res.status(200).json(await runConciergeTurn(request, { ownerId: signedIn?.id ?? null }));
  } catch (error) {
    next(error);
  }
};

/** Signed-in parents only (the route requires it): their latest stay for "same as last time". */
export const getConciergeLastStayHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: 'Sign in to see your last stay' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(200).json(await getConciergeLastStay(user.id));
  } catch (error) {
    next(error);
  }
};

/** The live total of a stay the guest built in the panel; signed, so it can be accepted as is. */
export const postConciergePrice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const request = conciergePriceRequestSchema.parse(req.body);
    res.status(200).json(await priceConciergeSelection(request));
  } catch (error) {
    next(error);
  }
};

export const postConciergeAcceptQuote = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { quoteToken } = conciergeAcceptQuoteSchema.parse(req.body);
    res.status(200).json(await acceptConciergeQuote(quoteToken));
  } catch (error) {
    next(error);
  }
};

export const postConciergeVerificationStart = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email } = conciergeVerificationStartSchema.parse(req.body);
    await startEmailVerification(email);
    // Same answer whether or not the address has an account.
    res.status(202).json({ status: 'code_sent' });
  } catch (error) {
    next(error);
  }
};

export const postConciergeVerificationConfirm = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, code } = conciergeVerificationConfirmSchema.parse(req.body);
    const identity = await confirmEmailAndResolveIdentity(email, code);
    let result: ConciergeVerificationResult;
    if (identity.kind === 'existing_owner') {
      // Proven control of the address is a sign-in: the booking joins the existing account.
      await setSessionCookie(res, identity.ownerId);
      result = { status: 'signed_in_existing_account' };
    } else {
      result = { status: 'verified_new_email', verificationToken: identity.verificationToken };
    }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const postConciergeCheckout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const request = conciergeCheckoutSchema.parse(req.body);
    const signedIn = await optionalPetOwner(req);
    const { ownerId, ...booking } = await checkoutConciergeBooking(request, {
      signedInOwnerId: signedIn?.id,
    });
    if (!signedIn) {
      await setSessionCookie(res, ownerId);
    }
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};
