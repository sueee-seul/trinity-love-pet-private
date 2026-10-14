import { Router } from 'express';
import { generateInsights, submitFeedback } from '../controllers/feedback.controller.js';
import { upload } from '../common/middlewares/upload.middleware.js';
import { requirePetParent, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';

// Each call is billed by the model provider, so it is limited to signed-in parents with a budget.
const insightBudget = rateLimit({ name: 'feedback-insights', limit: 10, windowMs: 60_000 });

const router = Router();

router.post(
  '/generate-insights',
  requirePetParent,
  requireTrustedOrigin,
  insightBudget,
  generateInsights,
);
router.post('/', requirePetParent, requireTrustedOrigin, upload.single('audio'), submitFeedback);

export default router;
