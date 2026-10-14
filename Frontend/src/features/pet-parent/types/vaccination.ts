// Response type for GET and PUT /api/petparent/vaccination/:bookingPetId.
// Mirrors Backend/src/services/petparent.vaccination.ts.

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
  /** The certificate on file for this stay, or null. The file is opened through its own link. */
  certificate: { uploadedAt: string | null } | null;
  /** False once drop-off time has passed: the answer and the file can no longer change here. */
  canChange: boolean;
  otherPets: VaccinationOtherPet[];
}

/** What the page sends: Yes always carries the certificate, No never does. */
export type VaccinationAnswer =
  { fullyVaccinated: true; certificate: File } | { fullyVaccinated: false };
