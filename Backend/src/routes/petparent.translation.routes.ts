import { Router } from 'express';
import { translateToEnglish } from '../controllers/petparent.translation.controller.js';
import { requirePetParent, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';

const QUARTER_HOUR_MS = 15 * 60 * 1000;

// Each call reaches the language model, so a signed-in parent has a budget well above what
// opening their own stays and pets needs.
const translationsPerParent = rateLimit({
  name: 'petparent-translations',
  limit: 60,
  windowMs: QUARTER_HOUR_MS,
});

const router = Router();

router.post(
  '/translations/english',
  requireTrustedOrigin,
  requirePetParent,
  translationsPerParent,
  translateToEnglish,
);

export default router;
