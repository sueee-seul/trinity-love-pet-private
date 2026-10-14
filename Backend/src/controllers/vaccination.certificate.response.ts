import type { NextFunction, Response } from 'express';
import { AppError } from '../common/middlewares/error.middleware.js';
import type { StoredCertificateFile } from '../services/vaccination.certificate.storage.js';

// Only these mean the file is really gone. Any other failure (no permission, a failed read) is a
// server fault that staff must hear about, so it goes to the error handler, which logs it and
// answers 500, instead of passing for a certificate that was never uploaded.
const MISSING_FILE_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);

const errorCodeOf = (error: Error): unknown => ('code' in error ? error.code : undefined);

/**
 * Streams a stored certificate to a caller the route and service already let through. The file
 * has no public URL; these headers keep it out of shared caches and stop a browser from treating
 * it as anything but the checked type. They are applied only once the file is found, so a missing
 * file still answers with a JSON 404.
 *
 * The key is served relative to `root`, so `send` checks only the key itself for dot segments (a
 * random name that never has one) and not the folder above it. Given the full path instead, a
 * folder such as `/srv/.data/certificates` would make every existing file answer 404.
 */
export const sendVaccinationCertificate = (
  res: Response,
  file: StoredCertificateFile,
  next: NextFunction,
): void => {
  res.sendFile(
    file.key,
    {
      root: file.directory,
      dotfiles: 'deny',
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${file.downloadName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      lastModified: false,
      etag: false,
    },
    (error?: Error) => {
      if (!error) return;
      const code = errorCodeOf(error);
      // The viewer closed the tab mid-download: nothing is wrong and nobody is left to answer.
      if (code === 'ECONNABORTED') return;
      if (res.headersSent) {
        console.error('[vaccination] certificate stream failed:', error.message);
        return;
      }
      if (typeof code === 'string' && MISSING_FILE_CODES.has(code)) {
        next(new AppError('Vaccination certificate not found', 'NOT_FOUND', 404));
        return;
      }
      next(error);
    },
  );
};
