import { Router } from 'express';
import {
  getCurrentReviewer,
  googleReviewerLogin,
  logoutReviewer,
} from '../controllers/reviewer-auth.controller.js';
import { requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { requireReviewer } from '../common/middlewares/reviewer.middleware.js';

const router = Router();

router.post('/google', requireTrustedOrigin, googleReviewerLogin);
router.get('/me', requireReviewer, getCurrentReviewer);
router.post('/logout', logoutReviewer);

export default router;
