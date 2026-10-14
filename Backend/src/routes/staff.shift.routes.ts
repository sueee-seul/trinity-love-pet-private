import { Router } from 'express';
import {
  getShiftNotes,
  getShiftStaffOptions,
  postShiftNote,
  putShiftNote,
  removeShiftNote,
} from '../controllers/staff.shift.controller.js';
import { requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/staff-options', requireManager, getShiftStaffOptions);
router.get('/', requireManager, getShiftNotes);
router.post('/', requireManager, postShiftNote);
router.put('/:id', requireManager, putShiftNote);
router.delete('/:id', requireManager, removeShiftNote);

export default router;
