// The Vaccination information page's endpoints (Backend/src/routes/petparent.vaccination.routes.ts).
import type { VaccinationAnswer, VaccinationDetail } from '../types/vaccination';
import { API_BASE, request } from './bookingApi';

const vaccinationPath = (bookingPetId: string): string =>
  `/petparent/vaccination/${encodeURIComponent(bookingPetId)}`;

/** GET: the stay, the answer and certificate on file, and the other pets on the booking. */
export function fetchVaccination(bookingPetId: string): Promise<VaccinationDetail> {
  return request<VaccinationDetail>(vaccinationPath(bookingPetId));
}

/** PUT: Yes with the certificate, or No, which clears a certificate on file. */
export function saveVaccination(
  bookingPetId: string,
  answer: VaccinationAnswer,
): Promise<VaccinationDetail> {
  const form = new FormData();
  form.append('fullyVaccinated', String(answer.fullyVaccinated));
  if (answer.fullyVaccinated) form.append('certificate', answer.certificate);
  return request<VaccinationDetail>(vaccinationPath(bookingPetId), { method: 'PUT', body: form });
}

/**
 * The certificate itself. It has no public address: this link works only with the parent's own
 * session cookie, which a normal link sends.
 */
export function vaccinationCertificateUrl(bookingPetId: string): string {
  return `${API_BASE}${vaccinationPath(bookingPetId)}/certificate`;
}
