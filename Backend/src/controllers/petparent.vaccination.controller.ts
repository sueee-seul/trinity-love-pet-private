import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as vaccinationService from '../services/petparent.vaccination.js';
import * as certificateAccess from '../services/vaccination.certificate.access.js';
import { sendVaccinationCertificate } from './vaccination.certificate.response.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

const bookingPetParamsSchema = z.object({ bookingPetId: z.string().uuid() });

// A multipart form sends every field as text; the file itself arrives as `req.file`.
const vaccinationAnswerSchema = z.object({ fullyVaccinated: z.enum(['true', 'false']) }).strict();

export const getVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { bookingPetId } = bookingPetParamsSchema.parse(req.params);
    res
      .status(200)
      .json(await vaccinationService.getVaccinationDetail(requireUser(req).id, bookingPetId));
  } catch (error) {
    next(error);
  }
};

export const putVaccination = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { bookingPetId } = bookingPetParamsSchema.parse(req.params);
    const { fullyVaccinated } = vaccinationAnswerSchema.parse(req.body ?? {});
    const detail = await vaccinationService.saveVaccinationAnswer(
      requireUser(req).id,
      bookingPetId,
      {
        fullyVaccinated: fullyVaccinated === 'true',
        certificate: req.file
          ? { originalName: req.file.originalname, bytes: req.file.buffer }
          : null,
      },
    );
    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
};

export const getOwnVaccinationCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { bookingPetId } = bookingPetParamsSchema.parse(req.params);
    const file = await certificateAccess.getCertificateForOwner(requireUser(req).id, bookingPetId);
    sendVaccinationCertificate(res, file, next);
  } catch (error) {
    next(error);
  }
};
