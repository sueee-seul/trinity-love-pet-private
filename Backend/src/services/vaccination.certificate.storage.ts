import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CERTIFICATE_CONTENT_TYPES,
  CERTIFICATE_FILE_EXTENSIONS,
  CERTIFICATE_FILE_KINDS,
  type CertificateFileKind,
} from './vaccination.certificate.file.js';

// Why certificates live on the backend's disk and not in object storage:
// the Neon bucket behind object.storage.ts serves every object at a public URL (profile media
// depends on that, see buildPublicObjectUrl), and nothing in this code base can make one object
// private inside it. A certificate there would be readable by anyone who learns or lists its key.
// A file under Backend/storage (gitignored, like task photos) has no URL at all: it is only ever
// streamed by the authenticated endpoints, after the owner or employee check. The row keeps only
// the random file name (`vaccination_document_url` holds this key, never a link). Moving to a
// private bucket later only changes this file.
//
// VACCINATION_CERTIFICATE_DIR points it at a persistent, backed-up volume. Production must set it:
// the default folder sits inside the checkout, which a redeploy or `git clean -X` wipes while the
// rows still say a certificate is on file, so without it every certificate call fails loudly
// instead of losing files quietly (the same fail-closed rule as AUTH_SESSION_SECRET).

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIRECTORY = path.resolve(serviceDirectory, '../../storage/vaccination-certificates');

// Owner-only read and write: the files hold a person's name and their vet's details.
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|heic)$/;

const KIND_BY_EXTENSION = new Map<string, CertificateFileKind>(
  CERTIFICATE_FILE_KINDS.map((kind) => [CERTIFICATE_FILE_EXTENSIONS[kind], kind]),
);

/** The folder certificates live in, always absolute (a relative setting is read from the cwd). */
export const vaccinationCertificateDirectory = (): string => {
  const configured = process.env.VACCINATION_CERTIFICATE_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VACCINATION_CERTIFICATE_DIR is not configured');
  }
  return DEFAULT_DIRECTORY;
};

/**
 * A stored certificate, as the folder and the file name inside it. The response serves the name
 * relative to the folder, so nothing in the folder's own path (a `.data` volume, a dotted home
 * directory) can make a file that exists read as missing.
 */
export interface StoredCertificateFile {
  directory: string;
  key: string;
  contentType: string;
  downloadName: string;
}

/** Writes the checked bytes under a new random name and returns that name, the stored key. */
export const saveVaccinationCertificate = async (
  bytes: Buffer,
  kind: CertificateFileKind,
): Promise<string> => {
  const directory = vaccinationCertificateDirectory();
  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  const key = `${randomUUID()}${CERTIFICATE_FILE_EXTENSIONS[kind]}`;
  await writeFile(path.join(directory, key), bytes, { flag: 'wx', mode: PRIVATE_FILE_MODE });
  return key;
};

/**
 * Where a stored key lives, and how to serve it. Anything that is not a key this module wrote
 * (a path, a URL, a traversal attempt) resolves to nothing.
 */
export const resolveVaccinationCertificate = (key: string): StoredCertificateFile | null => {
  if (!KEY_PATTERN.test(key)) return null;
  const extension = path.extname(key);
  const kind = KIND_BY_EXTENSION.get(extension);
  if (!kind) return null;
  return {
    directory: vaccinationCertificateDirectory(),
    key,
    contentType: CERTIFICATE_CONTENT_TYPES[kind],
    downloadName: `vaccination-certificate${extension}`,
  };
};

/** Deletes a stored certificate; a missing file is not an error. */
export const removeVaccinationCertificate = async (key: string): Promise<void> => {
  const stored = resolveVaccinationCertificate(key);
  if (stored) await rm(path.join(stored.directory, stored.key), { force: true });
};
