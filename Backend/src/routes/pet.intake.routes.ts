import { Router } from 'express';
import { readPetDescription } from '../controllers/pet.intake.controller.js';
import { requireAuth, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';

const router = Router();

/**
 * Signed in only, unlike the translation endpoint. This one reads a description of someone's own
 * animal, which there is no reason to do anonymously.
 *
 * Still budgeted: being signed in caps who can spend, not how much. Describing a pet is something
 * a person does a few times, so a low ceiling costs an honest owner nothing.
 */
const intakeBudget = rateLimit({ name: 'pet-intake', limit: 10, windowMs: 60_000 });

router.post(
  '/pet-description',
  requireAuth,
  requireTrustedOrigin,
  intakeBudget,
  readPetDescription,
);

export default router;
