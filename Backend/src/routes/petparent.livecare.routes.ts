import { Router } from 'express';
import { getLiveCare, streamLiveCare } from '../controllers/petparent.livecare.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/', requirePetParent, getLiveCare);
router.get('/:bookingPetId/stream', requirePetParent, streamLiveCare);
router.get('/:bookingPetId', requirePetParent, getLiveCare);

export default router;
