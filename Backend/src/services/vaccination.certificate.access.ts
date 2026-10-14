import { AppError } from '../common/middlewares/error.middleware.js';
import * as vaccinationRepo from '../repositories/petparent.vaccination.repository.js';
import {
  resolveVaccinationCertificate,
  type StoredCertificateFile,
} from './vaccination.certificate.storage.js';

// Who may open a stored certificate: the pet parent who booked the stay, and employees. The caller's
// role is checked by the route (requirePetParent or requireEmployee); ownership is checked here, in
// the query itself. Anything else reads as not found, so an id never reveals that a file exists.

const notFound = (): AppError =>
  new AppError('Vaccination certificate not found', 'NOT_FOUND', 404);

const toServableFile = (
  row: vaccinationRepo.StoredCertificateRow | null,
): StoredCertificateFile => {
  const stored = row ? resolveVaccinationCertificate(row.documentKey) : null;
  if (!stored) throw notFound();
  return stored;
};

export const getCertificateForOwner = async (
  petOwnersUuid: string,
  bookingPetId: string,
): Promise<StoredCertificateFile> =>
  toServableFile(await vaccinationRepo.findCertificateForOwner(petOwnersUuid, bookingPetId));

export const getCertificateForEmployee = async (
  bookingPetId: string,
): Promise<StoredCertificateFile> =>
  toServableFile(await vaccinationRepo.findCertificateForEmployee(bookingPetId));
