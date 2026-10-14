import { AppError } from '../common/middlewares/error.middleware.js';
import type { ManagerReviewStatus, StayStatus } from '../contracts/stay-status.contract.js';
import * as homeRepo from '../repositories/petparent.home.repository.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import * as vaccinationRepo from '../repositories/petparent.vaccination.repository.js';
import { isOpenRequest, toStayStatus } from './stay-status.js';
import { checkCertificateFile, type CertificateFileKind } from './vaccination.certificate.file.js';
import {
  removeVaccinationCertificate,
  saveVaccinationCertificate,
} from './vaccination.certificate.storage.js';

const DEFAULT_SERVICE_TYPE = 'Boarding';

export interface VaccinationOtherPet {
  bookingPetId: string;
  petName: string;
  fullyVaccinated: boolean | null;
  /** When that pet's certificate for this stay arrived; null while none is on file. */
  certificateUploadedAt: string | null;
}

export interface VaccinationDetail {
  bookingPetId: string;
  petName: string;
  fullyVaccinated: boolean | null;
  dropOffAt: string;
  pickUpAt: string;
  serviceType: string;
  /** The certificate on file for this stay, or null. Never its storage key. */
  certificate: { uploadedAt: string | null } | null;
  /** Whether the parent can still change the answer and the file on this page. */
  canChange: boolean;
  otherPets: VaccinationOtherPet[];
}

export interface VaccinationAnswerInput {
  fullyVaccinated: boolean;
  certificate: { originalName: string; bytes: Buffer } | null;
}

// A parent changes the answer only for a request that still stands and only before drop-off. From
// drop-off the proof has to come with the pet (Code of Welfare MS 6(b)) and staff check it at the
// desk, and a pending request whose dates have come was never booked in.
const CHANGEABLE_STAY_STATUSES: ReadonlySet<StayStatus> = new Set([
  'waiting_for_review',
  'approved',
]);
// The manager decisions behind those two statuses, for the write's own guard in the repository.
const CHANGEABLE_REVIEW_STATUSES: readonly ManagerReviewStatus[] = ['pending', 'approved'];

export const canChangeVaccination = (stay: HomeStayRow, now: Date): boolean =>
  CHANGEABLE_STAY_STATUSES.has(toStayStatus(stay, now)) &&
  now.getTime() < stay.dropOffTime.getTime();

const notFound = (): AppError =>
  new AppError('Vaccination information not found', 'NOT_FOUND', 404);

/** A refused or cancelled pet is not coming, so it has nothing to prepare: it reads as not found. */
const findOpenStay = async (petOwnersUuid: string, bookingPetId: string): Promise<HomeStayRow> => {
  const stay = await homeRepo.findHomeStayForOwner(petOwnersUuid, bookingPetId);
  if (!stay || !isOpenRequest(stay.reviewStatus)) throw notFound();
  return stay;
};

const findChangeableStay = async (
  petOwnersUuid: string,
  bookingPetId: string,
  now: Date,
): Promise<HomeStayRow> => {
  const stay = await findOpenStay(petOwnersUuid, bookingPetId);
  if (!canChangeVaccination(stay, now)) {
    throw new AppError(
      'Check-in time has passed, so the vaccination information can no longer be changed here',
      'STAY_ALREADY_STARTED',
      409,
    );
  }
  return stay;
};

const toIsoOrNull = (date: Date | null): string | null => date?.toISOString() ?? null;

/**
 * The page's content for one booking pet: the stay, the answer and certificate on file, and where
 * the pet's booking-mates stand. Refused and cancelled booking-mates are left out.
 */
export const getVaccinationDetail = async (
  petOwnersUuid: string,
  bookingPetId: string,
  now: Date = new Date(),
): Promise<VaccinationDetail> => {
  const stay = await findOpenStay(petOwnersUuid, bookingPetId);

  const bookingMates = await homeRepo.listOtherBookingPets(stay.bookingId, bookingPetId);
  const otherPets = bookingMates
    .filter((pet) => isOpenRequest(pet.reviewStatus))
    .map((pet) => ({
      bookingPetId: pet.bookingPetId,
      petName: pet.petName,
      fullyVaccinated: pet.fullyVaccinated,
      certificateUploadedAt: toIsoOrNull(pet.vaccinationCertificateUploadedAt),
    }));

  return {
    bookingPetId: stay.bookingPetId,
    petName: stay.petName,
    fullyVaccinated: stay.fullyVaccinated,
    dropOffAt: stay.dropOffTime.toISOString(),
    pickUpAt: stay.pickUpTime.toISOString(),
    serviceType: stay.serviceType ?? DEFAULT_SERVICE_TYPE,
    certificate: stay.hasVaccinationCertificate
      ? { uploadedAt: toIsoOrNull(stay.vaccinationCertificateUploadedAt) }
      : null,
    canChange: canChangeVaccination(stay, now),
    otherPets,
  };
};

/**
 * Yes needs a certificate and No must not carry one, so the answer on file always matches the
 * file on file. The file's own bytes decide its kind (see vaccination.certificate.file.ts).
 */
const checkAnswer = (input: VaccinationAnswerInput): CertificateFileKind | null => {
  if (!input.fullyVaccinated) {
    if (input.certificate) {
      throw new AppError(
        'Only send a certificate with a Yes answer',
        'VACCINATION_CERTIFICATE_UNEXPECTED',
        422,
      );
    }
    return null;
  }
  if (!input.certificate) {
    throw new AppError(
      "Please upload your pet's vaccination certificate",
      'VACCINATION_CERTIFICATE_REQUIRED',
      422,
    );
  }
  const check = checkCertificateFile(input.certificate);
  if (check.ok) return check.kind;
  if (check.problem === 'too_large') {
    throw new AppError('The file is larger than 10 MB', 'VACCINATION_FILE_TOO_LARGE', 413);
  }
  throw new AppError('Upload a PDF, JPG, PNG or HEIC file', 'VACCINATION_FILE_UNSUPPORTED', 422);
};

// Deleting a file that no row points to any more must not undo a save that already happened, so a
// failure is logged (the random key only, nothing personal) instead of thrown.
const removeUnreferencedCertificate = async (documentKey: string): Promise<void> => {
  try {
    await removeVaccinationCertificate(documentKey);
  } catch (error) {
    console.error(
      `[vaccination] could not remove certificate ${documentKey}:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
};

/**
 * Saves the Yes or No answer for one stay. Yes stores the new certificate; No clears the one on
 * file. The file that was replaced or cleared is deleted after the row is saved.
 */
export const saveVaccinationAnswer = async (
  petOwnersUuid: string,
  bookingPetId: string,
  input: VaccinationAnswerInput,
  now: Date = new Date(),
): Promise<VaccinationDetail> => {
  const kind = checkAnswer(input);
  await findChangeableStay(petOwnersUuid, bookingPetId, now);

  const documentKey =
    input.certificate && kind
      ? await saveVaccinationCertificate(input.certificate.bytes, kind)
      : null;

  let result: vaccinationRepo.VaccinationAnswerWriteResult;
  try {
    result = await vaccinationRepo.saveVaccinationAnswer({
      petOwnersUuid,
      bookingPetId,
      fullyVaccinated: input.fullyVaccinated,
      documentKey,
      uploadedAt: documentKey ? now : null,
      openReviewStatuses: CHANGEABLE_REVIEW_STATUSES,
      dropOffAfter: now,
    });
  } catch (error) {
    if (documentKey) await removeUnreferencedCertificate(documentKey);
    throw error;
  }

  if (!result.saved) {
    // The manager decided, or drop-off came, between the check and the write: answer as the check
    // would now.
    if (documentKey) await removeUnreferencedCertificate(documentKey);
    await findChangeableStay(petOwnersUuid, bookingPetId, now);
    throw new AppError('This stay changed while saving. Please try again.', 'CONFLICT', 409);
  }

  if (result.previousDocumentKey && result.previousDocumentKey !== documentKey) {
    await removeUnreferencedCertificate(result.previousDocumentKey);
  }
  return getVaccinationDetail(petOwnersUuid, bookingPetId, now);
};
