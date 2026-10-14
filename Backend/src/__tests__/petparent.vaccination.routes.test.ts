import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import {
  BOOKING_PET_ID,
  EMPLOYEE,
  OTHER_OWNER,
  OWNER,
  PDF,
  USERS,
  VACCINATION_URL as URL,
  cookieFor,
  createVaccinationApp as createApp,
  useTestSessionSecret,
} from './fixtures/vaccination.routes.fixtures.js';

// Saving the answer and the file. Opening a stored certificate is tested in
// vaccination.certificate.routes.test.ts.

const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));
const homeRepo = vi.hoisted(() => ({
  findHomeStayForOwner: vi.fn(),
  listOtherBookingPets: vi.fn(),
}));
const vaccinationRepo = vi.hoisted(() => ({
  saveVaccinationAnswer: vi.fn(),
  findCertificateForOwner: vi.fn(),
  findCertificateForEmployee: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));
vi.mock('../repositories/petparent.home.repository.js', () => homeRepo);
vi.mock('../repositories/petparent.vaccination.repository.js', () => vaccinationRepo);

const DAY_MS = 86_400_000;

const stayFor = (overrides: Partial<HomeStayRow> = {}): HomeStayRow => ({
  bookingId: '00000000-0000-4000-8000-000000000501',
  bookingPetId: BOOKING_PET_ID,
  reviewStatus: 'approved',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  petId: '00000000-0000-4000-8000-000000000401',
  petName: 'Max',
  petPhotoUrl: null,
  dropOffTime: new Date(Date.now() + 3 * DAY_MS),
  pickUpTime: new Date(Date.now() + 6 * DAY_MS),
  serviceType: 'Overnight boarding',
  fullyVaccinated: null,
  hasVaccinationCertificate: false,
  vaccinationCertificateUploadedAt: null,
  hasAgreement: true,
  paymentSucceeded: true,
  ...overrides,
});

let directory = '';

beforeEach(async () => {
  useTestSessionSecret();
  directory = await mkdtemp(path.join(os.tmpdir(), 'vaccination-routes-'));
  process.env.VACCINATION_CERTIFICATE_DIR = directory;
  vi.clearAllMocks();
  findUserByIdMock.mockImplementation(async (id: string) => USERS.find((u) => u.id === id) ?? null);
  homeRepo.listOtherBookingPets.mockResolvedValue([]);
  vaccinationRepo.saveVaccinationAnswer.mockResolvedValue({
    saved: true,
    previousDocumentKey: null,
  });
});

afterEach(async () => {
  delete process.env.VACCINATION_CERTIFICATE_DIR;
  await rm(directory, { recursive: true, force: true });
});

const storedFiles = (): Promise<string[]> => readdir(directory).catch(() => []);

describe('PUT /api/petparent/vaccination/:bookingPetId', () => {
  it('saves Yes with the certificate for the signed-in owner and returns the page state', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValueOnce(stayFor()).mockResolvedValueOnce(
      stayFor({
        fullyVaccinated: true,
        hasVaccinationCertificate: true,
        vaccinationCertificateUploadedAt: new Date('2026-09-29T01:00:00.000Z'),
      }),
    );

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max-vaccinations.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      bookingPetId: BOOKING_PET_ID,
      certificate: { uploadedAt: '2026-09-29T01:00:00.000Z' },
      canChange: true,
    });
    const files = await storedFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(homeRepo.findHomeStayForOwner).toHaveBeenCalledWith(OWNER.id, BOOKING_PET_ID);
    expect(vaccinationRepo.saveVaccinationAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        petOwnersUuid: OWNER.id,
        bookingPetId: BOOKING_PET_ID,
        fullyVaccinated: true,
        documentKey: files[0],
      }),
    );
  });

  it('answers 401 to a guest and never reads the upload', async () => {
    const response = await request(createApp())
      .put(URL)
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max.pdf');

    expect(response.status).toBe(401);
    expect(homeRepo.findHomeStayForOwner).not.toHaveBeenCalled();
    expect(await storedFiles()).toEqual([]);
  });

  it('answers 403 to an employee session', async () => {
    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(EMPLOYEE))
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max.pdf');

    expect(response.status).toBe(403);
    expect(await storedFiles()).toEqual([]);
  });

  it('answers 403 to a page from another origin', async () => {
    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .set('Origin', 'https://evil.example')
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max.pdf');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('UNTRUSTED_ORIGIN');
  });

  it("answers 404 for another owner's booking pet and stores nothing", async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(null);

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OTHER_OWNER))
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max.pdf');

    expect(response.status).toBe(404);
    expect(homeRepo.findHomeStayForOwner).toHaveBeenCalledWith(OTHER_OWNER.id, BOOKING_PET_ID);
    expect(vaccinationRepo.saveVaccinationAnswer).not.toHaveBeenCalled();
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects a file whose bytes are not a PDF, JPG, PNG or HEIC', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(stayFor());

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'true')
      .attach('certificate', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'max.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VACCINATION_FILE_UNSUPPORTED');
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects a file over 10 MB', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(stayFor());

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'true')
      .attach('certificate', Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), 'max.pdf');

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('VACCINATION_FILE_TOO_LARGE');
    expect(vaccinationRepo.saveVaccinationAnswer).not.toHaveBeenCalled();
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects Yes without a certificate', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(stayFor());

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'true');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VACCINATION_CERTIFICATE_REQUIRED');
  });

  it('rejects an answer that is not Yes or No', async () => {
    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'maybe');

    expect(response.status).toBe(400);
    expect(homeRepo.findHomeStayForOwner).not.toHaveBeenCalled();
  });

  it('rejects a change once drop-off time has passed', async () => {
    homeRepo.findHomeStayForOwner.mockResolvedValue(
      stayFor({ reviewStatus: 'pending', dropOffTime: new Date(Date.now() - 60_000) }),
    );

    const response = await request(createApp())
      .put(URL)
      .set('Cookie', await cookieFor(OWNER))
      .field('fullyVaccinated', 'true')
      .attach('certificate', PDF, 'max.pdf');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STAY_ALREADY_STARTED');
    expect(await storedFiles()).toEqual([]);
  });

  it.each(['refused', 'cancelled'] as const)(
    'answers 404 for a %s booking pet',
    async (reviewStatus) => {
      homeRepo.findHomeStayForOwner.mockResolvedValue(stayFor({ reviewStatus }));

      const response = await request(createApp())
        .put(URL)
        .set('Cookie', await cookieFor(OWNER))
        .field('fullyVaccinated', 'true')
        .attach('certificate', PDF, 'max.pdf');

      expect(response.status).toBe(404);
      expect(await storedFiles()).toEqual([]);
    },
  );
});
