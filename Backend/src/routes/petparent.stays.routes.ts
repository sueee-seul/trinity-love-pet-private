import { Router } from 'express';
import { getStays } from '../controllers/petparent.stays.controller.js';
import { getStaySummaries } from '../controllers/petparent.summaries.controller.js';
import { getStayReportShareLink } from '../controllers/stay-report.share.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/', requirePetParent, getStays);
// The updates sent for this stay, newest first: each day's update and the report at check-out.
router.get('/:bookingPetId/summaries', requirePetParent, getStaySummaries);
// A 30-day link the parent can give their vet; it opens the report without a sign-in.
router.get('/:bookingPetId/report/share-link', requirePetParent, getStayReportShareLink);

export default router;
