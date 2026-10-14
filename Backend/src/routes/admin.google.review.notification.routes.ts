import { Router } from 'express';
import { requireManager, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import {
  getManagerGoogleReviewNotifications,
  markManagerGoogleReviewNotificationRead,
  readAllManagerGoogleReviewNotifications,
} from '../controllers/admin.google.review.notification.controller.js';

const router = Router();

router.use(requireManager);
router.get('/', getManagerGoogleReviewNotifications);
router.patch('/read-all', requireTrustedOrigin, readAllManagerGoogleReviewNotifications);
router.patch('/:id/read', requireTrustedOrigin, markManagerGoogleReviewNotificationRead);

export default router;
