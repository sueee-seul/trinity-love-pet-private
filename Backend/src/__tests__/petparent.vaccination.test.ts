import { beforeEach, describe, expect, it, vi } from 'vitest';

const homeRepo = vi.hoisted(() => ({
  findHomeStayForOwner: vi.fn(),
  listOtherBookingPets: vi.fn(),
}));
const vaccinationRepo = vi.hoisted(() => ({ saveVaccinationAnswer: vi.fn() }));
const storage = vi.hoisted(() => ({
  saveVaccinationCertificate: vi.fn(),
  removeVaccinationCertificate: vi.fn(),
}));

vi.mock('../repositories/petparent.home.repository.js', () => homeRepo);
vi.mock('../repositories/petparent.vaccination.repository.js', () => vaccinationRepo);
vi.mock('../services/vaccination.certificate.storage.js', () => storage);
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

import {
  canChangeVaccination,
  getVaccinationDetail,
  saveVaccinationAnswer,
} from '../services/petparent.vaccination.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';

const NOW = new Date(2026, 8, 7, 10, 0);
const UPLOADED_AT = new Date(2026, 8, 2, 12, 0);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n');

const stay: HomeStayRow = {
  bookingId: 'booking-1',
  bookingPetId: 'bp-max',
  reviewStatus: 'pending',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  petId: 'pet-max',
  petName: 'Max',
  petPhotoUrl: null,
  dropOffTime: new Date(2026, 8, 12, 9, 0),
  pickUpTime: new Date(2026, 8, 16, 9, 0),
  serviceType: 'Overnight boarding',
  fullyVaccinated: false,
  hasVaccinationCertificate: false,
  vaccinationCertificateUploadedAt: null,
  hasAgreement: true,
  paymentSucceeded: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  homeRepo.listOtherBookingPets.mockResolvedValue([]);
  storage.saveVaccinationCertificate.mockResolvedValue('new-key.pdf');
  storage.removeVaccinationCertificate.mockResolvedValue(undefined);
});

describe('getVaccinationDetail', () => {
  it('404s when the booking pet does not belong to this owner', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(null);
    await expect(getVaccinationDetail('owner-1', 'bp-unknown', NOW)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it.each(['refused', 'cancelled'] as const)(
    '404s for a %s booking pet, which has nothing left to prepare',
    async (reviewStatus) => {
      homeRepo.findHomeStayForOwner.mockResolvedValue({ ...stay, reviewStatus });
      await expect(getVaccinationDetail('owner-1', 'bp-max', NOW)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    },
  );

  it('returns the pet, stay, certificate state and the booking-mates still coming', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(stay);
    homeRepo.listOtherBookingPets.mockResolvedValue([
      {
        bookingPetId: 'bp-luna',
        petName: 'Luna',
        fullyVaccinated: true,
        vaccinationCertificateUploadedAt: UPLOADED_AT,
        reviewStatus: 'approved',
      },
      {
        bookingPetId: 'bp-rex',
        petName: 'Rex',
        fullyVaccinated: false,
        vaccinationCertificateUploadedAt: null,
        reviewStatus: 'refused',
      },
      {
        bookingPetId: 'bp-bo',
        petName: 'Bo',
        fullyVaccinated: false,
        vaccinationCertificateUploadedAt: null,
        reviewStatus: 'cancelled',
      },
    ]);

    const detail = await getVaccinationDetail('owner-1', 'bp-max', NOW);

    expect(homeRepo.listOtherBookingPets).toHaveBeenCalledWith('booking-1', 'bp-max');
    expect(detail).toEqual({
      bookingPetId: 'bp-max',
      petName: 'Max',
      fullyVaccinated: false,
      dropOffAt: stay.dropOffTime.toISOString(),
      pickUpAt: stay.pickUpTime.toISOString(),
      serviceType: 'Overnight boarding',
      certificate: null,
      canChange: true,
      otherPets: [
        {
          bookingPetId: 'bp-luna',
          petName: 'Luna',
          fullyVaccinated: true,
          certificateUploadedAt: UPLOADED_AT.toISOString(),
        },
      ],
    });
  });

  it('reports an uploaded certificate by its date, never its storage key', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue({
      ...stay,
      fullyVaccinated: true,
      hasVaccinationCertificate: true,
      vaccinationCertificateUploadedAt: UPLOADED_AT,
    });

    const detail = await getVaccinationDetail('owner-1', 'bp-max', NOW);

    expect(detail.certificate).toEqual({ uploadedAt: UPLOADED_AT.toISOString() });
    expect(JSON.stringify(detail)).not.toContain('key');
  });

  it('falls back to the default service type when none is set', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue({ ...stay, serviceType: null });

    const detail = await getVaccinationDetail('owner-1', 'bp-max', NOW);

    expect(detail.serviceType).toBe('Boarding');
    expect(detail.otherPets).toEqual([]);
  });
});

describe('canChangeVaccination', () => {
  it.each([
    ['pending before drop-off', { reviewStatus: 'pending' as const }, NOW, true],
    ['approved before drop-off', { reviewStatus: 'approved' as const }, NOW, true],
    ['pending once drop-off came', { reviewStatus: 'pending' as const }, stay.dropOffTime, false],
    ['approved and staying', { reviewStatus: 'approved' as const }, new Date(2026, 8, 13), false],
    ['refused', { reviewStatus: 'refused' as const }, NOW, false],
    ['cancelled', { reviewStatus: 'cancelled' as const }, NOW, false],
  ])('%s -> %s', (_label, overrides, now, expected) => {
    expect(canChangeVaccination({ ...stay, ...overrides }, now)).toBe(expected);
  });
});

describe('saveVaccinationAnswer', () => {
  const yesWith = (
    bytes: Buffer,
    originalName = 'max.pdf',
  ): Parameters<typeof saveVaccinationAnswer>[2] => ({
    fullyVaccinated: true,
    certificate: { originalName, bytes },
  });

  beforeEach(() => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(stay);
    vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({
      saved: true,
      previousDocumentKey: null,
    });
  });

  it('stores the checked file and saves Yes with its key and the upload time', async () => {
    await saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW);

    expect(storage.saveVaccinationCertificate).toHaveBeenCalledWith(PDF, 'pdf');
    expect(vaccinationRepo.saveVaccinationAnswer).toHaveBeenCalledWith({
      petOwnersUuid: 'owner-1',
      bookingPetId: 'bp-max',
      fullyVaccinated: true,
      documentKey: 'new-key.pdf',
      uploadedAt: NOW,
      openReviewStatuses: ['pending', 'approved'],
      dropOffAfter: NOW,
    });
    expect(storage.removeVaccinationCertificate).not.toHaveBeenCalled();
  });

  it('deletes the replaced file once the new one is saved', async () => {
    vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({
      saved: true,
      previousDocumentKey: 'old-key.png',
    });

    await saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW);

    expect(storage.removeVaccinationCertificate).toHaveBeenCalledWith('old-key.png');
  });

  it('keeps the save when the replaced file cannot be deleted', async () => {
    vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({
      saved: true,
      previousDocumentKey: 'old-key.png',
    });
    storage.removeVaccinationCertificate.mockRejectedValue(new Error('disk busy'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW),
    ).resolves.toMatchObject({ bookingPetId: 'bp-max' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('saves No by clearing the certificate on file and deleting it', async () => {
    vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({
      saved: true,
      previousDocumentKey: 'old-key.pdf',
    });

    await saveVaccinationAnswer(
      'owner-1',
      'bp-max',
      { fullyVaccinated: false, certificate: null },
      NOW,
    );

    expect(storage.saveVaccinationCertificate).not.toHaveBeenCalled();
    expect(vaccinationRepo.saveVaccinationAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ fullyVaccinated: false, documentKey: null, uploadedAt: null }),
    );
    expect(storage.removeVaccinationCertificate).toHaveBeenCalledWith('old-key.pdf');
  });

  it.each([
    [
      'Yes without a file',
      { fullyVaccinated: true, certificate: null },
      422,
      'VACCINATION_CERTIFICATE_REQUIRED',
    ],
    [
      'No with a file',
      { fullyVaccinated: false, certificate: { originalName: 'max.pdf', bytes: PDF } },
      422,
      'VACCINATION_CERTIFICATE_UNEXPECTED',
    ],
    [
      'a text file named .pdf',
      {
        fullyVaccinated: true,
        certificate: { originalName: 'max.pdf', bytes: Buffer.from('hello') },
      },
      422,
      'VACCINATION_FILE_UNSUPPORTED',
    ],
    [
      'a PDF named .docx',
      { fullyVaccinated: true, certificate: { originalName: 'max.docx', bytes: PDF } },
      422,
      'VACCINATION_FILE_UNSUPPORTED',
    ],
    [
      'a file over 10 MB',
      {
        fullyVaccinated: true,
        certificate: {
          originalName: 'max.pdf',
          bytes: Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]),
        },
      },
      413,
      'VACCINATION_FILE_TOO_LARGE',
    ],
  ])('rejects %s before anything is stored', async (_label, input, statusCode, code) => {
    await expect(saveVaccinationAnswer('owner-1', 'bp-max', input, NOW)).rejects.toMatchObject({
      statusCode,
      code,
    });
    expect(storage.saveVaccinationCertificate).not.toHaveBeenCalled();
    expect(vaccinationRepo.saveVaccinationAnswer).not.toHaveBeenCalled();
  });

  it("404s for another owner's booking pet and stores nothing", async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(null);

    await expect(
      saveVaccinationAnswer('owner-2', 'bp-max', yesWith(PDF), NOW),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(homeRepo.findHomeStayForOwner).toHaveBeenCalledWith('owner-2', 'bp-max');
    expect(storage.saveVaccinationCertificate).not.toHaveBeenCalled();
    expect(vaccinationRepo.saveVaccinationAnswer).not.toHaveBeenCalled();
  });

  it.each(['refused', 'cancelled'] as const)('404s for a %s booking pet', async (reviewStatus) => {
    homeRepo.findHomeStayForOwner.mockResolvedValue({ ...stay, reviewStatus });

    await expect(
      saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(storage.saveVaccinationCertificate).not.toHaveBeenCalled();
  });

  it.each([
    ['a pending request whose drop-off came', 'pending' as const],
    ['an approved stay under way', 'approved' as const],
  ])('refuses %s with 409', async (_label, reviewStatus) => {
    homeRepo.findHomeStayForOwner.mockResolvedValue({ ...stay, reviewStatus });

    await expect(
      saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), new Date(2026, 8, 13)),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAY_ALREADY_STARTED' });
    expect(storage.saveVaccinationCertificate).not.toHaveBeenCalled();
  });

  it('removes the new file when the stay was refused between the check and the write', async () => {
    homeRepo.findHomeStayForOwner
      .mockResolvedValueOnce(stay)
      .mockResolvedValueOnce({ ...stay, reviewStatus: 'refused' });
    vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({ saved: false });

    await expect(
      saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(storage.removeVaccinationCertificate).toHaveBeenCalledWith('new-key.pdf');
  });

  it('removes the new file when the database write fails', async () => {
    vaccinationRepo.saveVaccinationAnswer.mockRejectedValue(new Error('connection lost'));

    await expect(saveVaccinationAnswer('owner-1', 'bp-max', yesWith(PDF), NOW)).rejects.toThrow(
      'connection lost',
    );
    expect(storage.removeVaccinationCertificate).toHaveBeenCalledWith('new-key.pdf');
  });
});
