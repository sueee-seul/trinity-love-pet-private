import { ApiError } from '../../api/bookingApi';

// The picker's first check, so a wrong file is caught before it is sent. The server checks the
// file's own bytes again (Backend/src/services/vaccination.certificate.file.ts); these limits match.

export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

const CERTIFICATE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.heic', '.heif'] as const;

// Extensions as well as types: browsers often report no type for a HEIC photo.
export const CERTIFICATE_ACCEPT = [
  ...CERTIFICATE_EXTENSIONS,
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
].join(',');

/**
 * What is wrong with a certificate file. Kept as a key rather than words, so a message already on
 * screen follows the site language when the parent switches it (see vaccinationCopy.ts).
 */
export type CertificateProblem = 'required' | 'unsupported' | 'tooLarge' | 'empty';

/** Why a save failed: a file problem, or one of the stay or session reasons the server gives. */
export type SaveFailure = CertificateProblem | 'stayStarted' | 'notFound' | 'signedOut' | 'unknown';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

/** The problem with a file the picker should not accept, or null when it looks right. */
export function certificateFileProblem(file: File): CertificateProblem | null {
  const name = file.name.toLowerCase();
  if (!CERTIFICATE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'unsupported';
  }
  if (file.size === 0) return 'empty';
  if (file.size > CERTIFICATE_MAX_BYTES) return 'tooLarge';
  return null;
}

/** "240 KB", "1.8 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const errorCodeOf = (error: ApiError): string | null => {
  const body = error.body;
  if (!body || typeof body !== 'object' || !('error' in body)) return null;
  const inner = (body as { error: unknown }).error;
  if (!inner || typeof inner !== 'object' || !('code' in inner)) return null;
  const code = (inner as { code: unknown }).code;
  return typeof code === 'string' ? code : null;
};

/** Why a save failed, from the server's stable error code. */
export function saveFailureOf(error: unknown): SaveFailure {
  if (!(error instanceof ApiError)) return 'unknown';
  switch (errorCodeOf(error)) {
    case 'VACCINATION_FILE_TOO_LARGE':
      return 'tooLarge';
    case 'VACCINATION_FILE_UNSUPPORTED':
      return 'unsupported';
    case 'VACCINATION_CERTIFICATE_REQUIRED':
      return 'required';
    case 'STAY_ALREADY_STARTED':
      return 'stayStarted';
    default:
      break;
  }
  if (error.status === HTTP_NOT_FOUND) return 'notFound';
  if (error.status === HTTP_UNAUTHORIZED) return 'signedOut';
  return 'unknown';
}
