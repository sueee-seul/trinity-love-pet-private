import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { VACCINATION_CERTIFICATE_MAX_BYTES } from '../../services/vaccination.certificate.file.js';
import { AppError } from './error.middleware.js';

export const VACCINATION_CERTIFICATE_FIELD = 'certificate';

// One file and the Yes or No field, held in memory so the service can read the file's first bytes
// before anything is written. Multer stops reading at the size limit, so a huge upload never fills
// the memory. The route runs this after the sign-in check, so a guest's upload is never read.
const parseCertificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: VACCINATION_CERTIFICATE_MAX_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 1024,
  },
}).single(VACCINATION_CERTIFICATE_FIELD);

const toAppError = (error: unknown): unknown => {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError('The file is larger than 10 MB', 'VACCINATION_FILE_TOO_LARGE', 413);
  }
  return new AppError('Send one certificate file and a Yes or No answer', 'VALIDATION_FAILED', 400);
};

/** Multer's own errors become the stable codes the page maps to its messages. */
export const vaccinationCertificateUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  parseCertificateUpload(req, res, (error?: unknown) => {
    if (error) {
      next(toAppError(error));
      return;
    }
    next();
  });
};
