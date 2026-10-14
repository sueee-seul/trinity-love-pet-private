import { Router } from 'express';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';
import {
  getSharedStayPhoto,
  getSharedStayReport,
} from '../controllers/stay-report.share.controller.js';

const router = Router();

// Public by design: a vet opens the parent's link without an account. The token is the only key,
// so the route is rate limited against guessing, and the page carries no contact details.
const shareBudget = rateLimit({ name: 'share-stay-report', limit: 30, windowMs: 60_000 });

router.get('/stay-report/:token', shareBudget, getSharedStayReport);
// The page's photos: a separate budget, since one page load asks for up to six.
const photoBudget = rateLimit({ name: 'share-stay-photo', limit: 120, windowMs: 60_000 });
router.get('/stay-report/:token/photos/:taskId/:storedName', photoBudget, getSharedStayPhoto);

export default router;
