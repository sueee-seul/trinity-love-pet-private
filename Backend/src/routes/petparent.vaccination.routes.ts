import { Router } from 'express';
import {
  getOwnVaccinationCertificate,
  getVaccination,
  putVaccination,
} from '../controllers/petparent.vaccination.controller.js';
import { requirePetParent, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';
import { vaccinationCertificateUpload } from '../common/middlewares/vaccination-certificate-upload.middleware.js';

const router = Router();

router.get('/vaccination/:bookingPetId', requirePetParent, getVaccination);
// The sign-in check runs before the upload is read, so a guest's file is never buffered.
router.put(
  '/vaccination/:bookingPetId',
  requireTrustedOrigin,
  requirePetParent,
  vaccinationCertificateUpload,
  putVaccination,
);
router.get(
  '/vaccination/:bookingPetId/certificate',
  requirePetParent,
  getOwnVaccinationCertificate,
);

export default router;
