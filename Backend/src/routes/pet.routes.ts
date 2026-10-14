import { Router } from 'express';
import {
  getPetList,
  getPetDetail,
  updatePetProfile,
  updatePetHealthNotes,
  updatePetBehaviourNotes,
  createPetMedication,
  updatePetMedication,
  deletePetMedication,
} from '../controllers/pet.controller.js';
import {
  createPetAssignment,
  deletePetAssignment,
  getPetAssignments,
} from '../controllers/pet.assignment.controller.js';
import { requireEmployee, requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();

// These are the facility's own records - a pet's health notes, medication and
// check-in state are not public, and nothing here was ever meant to answer an
// unauthenticated caller. Rostering a carer onto a pet stays a manager's call;
// the day-to-day pet record is any employee's to read and keep current.
router.use(requireEmployee);

router.get('/', getPetList);
router.get('/:id/assignments', getPetAssignments);
router.post('/:id/assignments', requireManager, createPetAssignment);
router.delete('/:id/assignments/:assignmentId', requireManager, deletePetAssignment);
router.get('/:id', getPetDetail);
router.patch('/:id/health-notes', updatePetHealthNotes);
router.patch('/:id/behaviour-notes', updatePetBehaviourNotes);
router.post('/:id/medications', createPetMedication);
router.patch('/:id/medications/:medicationId', updatePetMedication);
router.delete('/:id/medications/:medicationId', deletePetMedication);
// Keep the generic profile update after every more-specific PATCH/POST route.
// Express otherwise treats /:id as a match for the maintenance paths above.
router.patch('/:id', updatePetProfile);

export default router;
