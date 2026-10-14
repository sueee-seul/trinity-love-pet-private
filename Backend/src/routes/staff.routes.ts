import { Router } from 'express';
import {
  createStaff,
  deleteStaff,
  getStaffAssignments,
  getStaffByEmail,
  getStaffDetail,
  getStaffList,
  getStaffManagementOptions,
  updateOwnStaffProfile,
  updateStaff,
} from '../controllers/staff.controller.js';
import { requireEmployee, requireManager } from '../common/middlewares/auth.middleware.js';
import { resolveTargetStaffId } from '../common/middlewares/staff.middleware.js';

const router = Router();

// `/me` is declared before `/:id` so the literal path is not captured as an id.
router.get('/me', requireEmployee, getStaffByEmail);
router.get('/options', requireManager, getStaffManagementOptions);
router.get('/', requireManager, getStaffList);
router.post('/', requireManager, createStaff);
router.get('/:id', requireEmployee, resolveTargetStaffId, getStaffDetail);
router.get('/:id/assignments', requireEmployee, resolveTargetStaffId, getStaffAssignments);
router.patch('/:id', requireManager, updateStaff);
router.patch('/:id/self', requireEmployee, updateOwnStaffProfile);
router.delete('/:id', requireManager, deleteStaff);

export default router;
