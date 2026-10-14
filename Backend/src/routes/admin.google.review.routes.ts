import { Router } from 'express';
import {
  requireEmployee,
  requireManager,
  requireTrustedOrigin,
} from '../common/middlewares/auth.middleware.js';
import {
  assignGoogleReviewsHandler,
  getAdminGoogleReviewDashboard,
  getAdminGoogleReviewList,
  replyToGoogleReviewHandler,
  updateGoogleReviewTriageHandler,
} from '../controllers/admin.google.review.controller.js';
import { streamAdminGoogleReviewEvents } from '../controllers/google.review.events.controller.js';

const router = Router();

router.use(requireEmployee);
router.get('/events', streamAdminGoogleReviewEvents);
router.get('/dashboard', requireManager, getAdminGoogleReviewDashboard);
router.get('/', getAdminGoogleReviewList);
router.patch('/assignee', requireManager, requireTrustedOrigin, assignGoogleReviewsHandler);
router.patch('/:id/type', requireManager, requireTrustedOrigin, updateGoogleReviewTriageHandler);
router.post('/:id/reply', requireTrustedOrigin, replyToGoogleReviewHandler);

/**
 * Defines the Express router for Admin Google Review operations.
 *
 * @remarks
 * Enforces employee and manager authentication boundaries across all registered routes.
 */
export default router;
