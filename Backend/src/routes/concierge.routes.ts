import { Router } from 'express';
import {
  getConciergeCatalogue,
  getConciergeLastStayHandler,
  getConciergeRatesHandler,
  getConciergeStatusHandler,
  getConciergeTermsHandler,
  postConciergeAcceptQuote,
  postConciergeCardSetup,
  postConciergeChat,
  postConciergeCheckout,
  postConciergePrice,
  postConciergeVerificationConfirm,
  postConciergeVerificationStart,
} from '../controllers/concierge.controller.js';
import { requirePetParent, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';
import { postConciergeDetailsRead } from '../controllers/concierge.details-reader.controller.js';

/**
 * The public booking concierge. None of these routes require a session - that is the point of the
 * feature - so each one that can cost money or send mail carries its own budget, and every write
 * checks the Origin header the way the signed-in routes do.
 */
const router = Router();

/** A chat turn may call the model; a real conversation is a few turns a minute. */
const chatBudget = rateLimit({ name: 'concierge-chat', limit: 20, windowMs: 60_000 });
/** Codes go to someone's inbox, so starts are tight per client on top of the per-email cooldown. */
const codeBudget = rateLimit({ name: 'concierge-code', limit: 5, windowMs: 15 * 60_000 });
/** Wrong-code guesses are bounded per email by the store and per client here. */
const confirmBudget = rateLimit({ name: 'concierge-confirm', limit: 15, windowMs: 15 * 60_000 });
const writeBudget = rateLimit({ name: 'concierge-write', limit: 20, windowMs: 60_000 });

router.get('/catalogue', getConciergeCatalogue);
router.get('/rates', getConciergeRatesHandler);
router.get('/status', getConciergeStatusHandler);
router.get('/terms', getConciergeTermsHandler);
/** The only concierge read that needs a session: it is the parent's own booking history. */
router.get('/last-stay', requirePetParent, getConciergeLastStayHandler);
router.post('/chat', requireTrustedOrigin, chatBudget, postConciergeChat);
/** Pricing is a pure calculation, but it is still a write-shaped public call with a budget. */
router.post('/price', requireTrustedOrigin, writeBudget, postConciergePrice);
router.post('/quotes/accept', requireTrustedOrigin, writeBudget, postConciergeAcceptQuote);
router.post(
  '/verification/start',
  requireTrustedOrigin,
  codeBudget,
  postConciergeVerificationStart,
);
router.post(
  '/verification/confirm',
  requireTrustedOrigin,
  confirmBudget,
  postConciergeVerificationConfirm,
);
/** Reads a spoken or typed description into the booking form; it calls the model, so a tight budget. */
const readerBudget = rateLimit({ name: 'concierge-details-reader', limit: 6, windowMs: 60_000 });
router.post('/details/read', requireTrustedOrigin, readerBudget, postConciergeDetailsRead);
router.post('/card-setup', requireTrustedOrigin, writeBudget, postConciergeCardSetup);
router.post('/checkout', requireTrustedOrigin, writeBudget, postConciergeCheckout);

export default router;
