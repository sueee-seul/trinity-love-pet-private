import { Router } from 'express';
import { getVaccinationCertificate } from '../controllers/admin.vaccination.controller.js';
import { requireEmployee } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/:bookingPetId', requireEmployee, getVaccinationCertificate);

export default router;
