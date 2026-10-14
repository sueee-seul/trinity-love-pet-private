import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as certificateAccess from '../services/vaccination.certificate.access.js';
import { sendVaccinationCertificate } from './vaccination.certificate.response.js';

const bookingPetParamsSchema = z.object({ bookingPetId: z.string().uuid() });

/** Any employee: staff check the certificate at drop-off, the manager when reviewing a request. */
export const getVaccinationCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { bookingPetId } = bookingPetParamsSchema.parse(req.params);
    sendVaccinationCertificate(
      res,
      await certificateAccess.getCertificateForEmployee(bookingPetId),
      next,
    );
  } catch (error) {
    next(error);
  }
};
