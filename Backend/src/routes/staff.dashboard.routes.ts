import { Router } from 'express';
import { getOverview, getStaffDetail } from '../controllers/staff.dashboard.controller.js';
import { requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();
router.get('/', requireManager, getOverview);
router.get('/:staffId', requireManager, getStaffDetail);
export default router;
