import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKING_PET_ID,
  EMPLOYEE,
  OTHER_OWNER,
  OWNER,
  PDF,
  STAFF_CERTIFICATE_URL,
  USERS,
  VACCINATION_URL as URL,
  cookieFor,
  createVaccinationApp as createApp,
  useTestSessionSecret,
} from './fixtures/vaccination.routes.fixtures.js';

// Who can open a stored certificate, and how it is served. The PUT side lives in
// petparent.vaccination.routes.test.ts.

const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));
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
vi.mock('../repositories/petparent.home.repository.js', () => ({
  findHomeStayForOwner: vi.fn(),
  listOtherBookingPets: vi.fn(),
}));
vi.mock('../repositories/petparent.vaccination.repository.js', () => vaccinationRepo);

let directory = '';

beforeEach(async () => {
  useTestSessionSecret();
  directory = await mkdtemp(path.join(os.tmpdir(), 'vaccination-certificate-routes-'));
  process.env.VACCINATION_CERTIFICATE_DIR = directory;
  vi.clearAllMocks();
  findUserByIdMock.mockImplementation(async (id: string) => USERS.find((u) => u.id === id) ?? null);
});

afterEach(async () => {
  delete process.env.VACCINATION_CERTIFICATE_DIR;
  await rm(directory, { recursive: true, force: true });
});

describe('GET certificate files', () => {
  const storeCertificate = async (): Promise<string> => {
    const key = '3f2c7a4e-1b2c-4d5e-8f90-123456789abc.pdf';
    await writeFile(path.join(directory, key), PDF);
    return key;
  };

  it('streams the certificate to its owner, privately and as the checked type', async () => {
    const key = await storeCertificate();
    vaccinationRepo.findCertificateForOwner.mockResolvedValue({
      documentKey: key,
      uploadedAt: new Date(),
    });

    const response = await request(createApp())
      .get(`${URL}/certificate`)
      .set('Cookie', await cookieFor(OWNER))
      .buffer(true);

    expect(response.status).toBe(200);
    expect(vaccinationRepo.findCertificateForOwner).toHaveBeenCalledWith(OWNER.id, BOOKING_PET_ID);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(response.body as Buffer)).toEqual(PDF);
  });

  it("answers 404 when the certificate is another owner's", async () => {
    await storeCertificate();
    vaccinationRepo.findCertificateForOwner.mockResolvedValue(null);

    const response = await request(createApp())
      .get(`${URL}/certificate`)
      .set('Cookie', await cookieFor(OTHER_OWNER));

    expect(response.status).toBe(404);
    expect(vaccinationRepo.findCertificateForOwner).toHaveBeenCalledWith(
      OTHER_OWNER.id,
      BOOKING_PET_ID,
    );
  });

  it('answers 401 to a guest on both the owner and the staff link', async () => {
    const owner = await request(createApp()).get(`${URL}/certificate`);
    const staff = await request(createApp()).get(STAFF_CERTIFICATE_URL);

    expect(owner.status).toBe(401);
    expect(staff.status).toBe(401);
    expect(vaccinationRepo.findCertificateForEmployee).not.toHaveBeenCalled();
  });

  it('answers 403 to a pet parent on the staff link', async () => {
    const response = await request(createApp())
      .get(STAFF_CERTIFICATE_URL)
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(403);
    expect(vaccinationRepo.findCertificateForEmployee).not.toHaveBeenCalled();
  });

  it('streams any certificate to an employee', async () => {
    const key = await storeCertificate();
    vaccinationRepo.findCertificateForEmployee.mockResolvedValue({
      documentKey: key,
      uploadedAt: null,
    });

    const response = await request(createApp())
      .get(STAFF_CERTIFICATE_URL)
      .set('Cookie', await cookieFor(EMPLOYEE))
      .buffer(true);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(response.body as Buffer)).toEqual(PDF);
  });

  it('streams a certificate kept under a folder whose path has a dot segment', async () => {
    const dotted = path.join(directory, '.data', 'certificates');
    await mkdir(dotted, { recursive: true });
    process.env.VACCINATION_CERTIFICATE_DIR = dotted;
    const key = '3f2c7a4e-1b2c-4d5e-8f90-123456789abc.pdf';
    await writeFile(path.join(dotted, key), PDF);
    vaccinationRepo.findCertificateForEmployee.mockResolvedValue({
      documentKey: key,
      uploadedAt: null,
    });
    vaccinationRepo.findCertificateForOwner.mockResolvedValue({
      documentKey: key,
      uploadedAt: null,
    });

    const staff = await request(createApp())
      .get(STAFF_CERTIFICATE_URL)
      .set('Cookie', await cookieFor(EMPLOYEE))
      .buffer(true);
    const owner = await request(createApp())
      .get(`${URL}/certificate`)
      .set('Cookie', await cookieFor(OWNER))
      .buffer(true);

    expect(staff.status).toBe(200);
    expect(Buffer.from(staff.body as Buffer)).toEqual(PDF);
    expect(owner.status).toBe(200);
  });

  it('answers 500, not a quiet 404, when a stored certificate cannot be read', async () => {
    const key = '3f2c7a4e-1b2c-4d5e-8f90-123456789abc.pdf';
    // A folder where the file should be: the name exists but cannot be served as a file.
    await mkdir(path.join(directory, key));
    vaccinationRepo.findCertificateForEmployee.mockResolvedValue({
      documentKey: key,
      uploadedAt: null,
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(createApp())
      .get(STAFF_CERTIFICATE_URL)
      .set('Cookie', await cookieFor(EMPLOYEE));

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('answers 404 with JSON when the row points at a file that is gone', async () => {
    vaccinationRepo.findCertificateForEmployee.mockResolvedValue({
      documentKey: '3f2c7a4e-1b2c-4d5e-8f90-000000000000.png',
      uploadedAt: null,
    });

    const response = await request(createApp())
      .get(STAFF_CERTIFICATE_URL)
      .set('Cookie', await cookieFor(EMPLOYEE));

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
