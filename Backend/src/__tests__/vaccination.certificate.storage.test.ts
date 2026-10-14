import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeVaccinationCertificate,
  resolveVaccinationCertificate,
  saveVaccinationCertificate,
  vaccinationCertificateDirectory,
} from '../services/vaccination.certificate.storage.js';

const PDF = Buffer.from('%PDF-1.7\n');
let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'vaccination-certificates-'));
  process.env.VACCINATION_CERTIFICATE_DIR = directory;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  delete process.env.VACCINATION_CERTIFICATE_DIR;
  await rm(directory, { recursive: true, force: true });
});

describe('vaccination certificate storage', () => {
  it('writes the file under a new random key with the extension of its checked kind', async () => {
    const key = await saveVaccinationCertificate(PDF, 'pdf');
    const second = await saveVaccinationCertificate(PDF, 'jpeg');

    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(second).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(second).not.toBe(key);
    expect(await readFile(path.join(directory, key))).toEqual(PDF);
  });

  it('resolves a stored key to its file and the type it is served as', async () => {
    const key = await saveVaccinationCertificate(PDF, 'heic');

    expect(resolveVaccinationCertificate(key)).toEqual({
      directory,
      key,
      contentType: 'image/heic',
      downloadName: 'vaccination-certificate.heic',
    });
  });

  it.each([
    '../../.env',
    '../3f2c7a4e-1b2c-4d5e-8f90-123456789abc.pdf',
    '/etc/passwd',
    'https://bucket.example/vaccination/abc.pdf',
    '3f2c7a4e-1b2c-4d5e-8f90-123456789abc.exe',
    '3F2C7A4E-1B2C-4D5E-8F90-123456789ABC.pdf',
    '',
  ])('resolves %j to nothing', (key) => {
    expect(resolveVaccinationCertificate(key)).toBeNull();
  });

  it('reads a relative folder setting as an absolute path', () => {
    process.env.VACCINATION_CERTIFICATE_DIR = 'relative/certificates';

    expect(vaccinationCertificateDirectory()).toBe(path.resolve('relative/certificates'));
  });

  it('refuses to fall back to the checkout folder in production', async () => {
    delete process.env.VACCINATION_CERTIFICATE_DIR;
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => vaccinationCertificateDirectory()).toThrow(
      'VACCINATION_CERTIFICATE_DIR is not configured',
    );
    await expect(saveVaccinationCertificate(PDF, 'pdf')).rejects.toThrow(
      'VACCINATION_CERTIFICATE_DIR is not configured',
    );
  });

  it('removes a stored file, and a missing one is not an error', async () => {
    const key = await saveVaccinationCertificate(PDF, 'png');

    await removeVaccinationCertificate(key);
    await expect(stat(path.join(directory, key))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(removeVaccinationCertificate(key)).resolves.toBeUndefined();
  });
});
