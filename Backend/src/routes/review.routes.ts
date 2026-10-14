import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  attachReviewerIfPresent,
  requireReviewer,
  requireReviewSimulatorSecret,
} from '../common/middlewares/reviewer.middleware.js';
import {
  createHumanReview,
  createSimulatorReview,
  deleteMockGoogleBusinessReview,
  getGoogleReviewPage,
  likeGoogleReview,
  unlikeGoogleReview,
} from '../controllers/review.controller.js';
import { requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { reviewPhotoUpload } from '../common/middlewares/review-photo-upload.middleware.js';
import { streamPublicGoogleReviewEvents } from '../controllers/google.review.events.controller.js';

const requireNonProduction = (_req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ code: 404, msg: 'Not found', data: null });
    return;
  }
  next();
};

const router = Router();

router.get('/events', streamPublicGoogleReviewEvents);
// attachReviewerIfPresent must run first so a signed-in visitor gets their own like state,
// but it never rejects: the page stays public.
router.get('/', attachReviewerIfPresent, getGoogleReviewPage);
router.post(
  '/',
  requireReviewer,
  requireTrustedOrigin,
  reviewPhotoUpload.array('photos', 9),
  createHumanReview,
);
router.put('/:id/like', requireReviewer, requireTrustedOrigin, likeGoogleReview);
router.delete('/:id/like', requireReviewer, requireTrustedOrigin, unlikeGoogleReview);
router.delete('/:id', requireNonProduction, requireTrustedOrigin, deleteMockGoogleBusinessReview);

const reviewSimulatorRoutes = Router();
reviewSimulatorRoutes.post('/', requireReviewSimulatorSecret, createSimulatorReview);

export { reviewSimulatorRoutes };

export default router;
