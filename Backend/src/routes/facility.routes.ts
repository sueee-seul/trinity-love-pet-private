import { Router } from 'express';
import {
  getFacilityDetail,
  getFacilityList,
  updateFacility,
} from '../controllers/facility.controller.js';
import { requireEmployee, requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();

// Facility records are internal. Any employee needs to read them - the pet and
// staff screens resolve a facility name from here - but changing a site's
// capacity or address is a manager's decision, so the write is held higher.
router.use(requireEmployee);

router.get('/', getFacilityList);
router.get('/:id', getFacilityDetail);
router.patch('/:id', requireManager, updateFacility);

export default router;
