import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../bookingApi';
import { saveVaccination, vaccinationCertificateUrl } from '../vaccinationApi';

// The upload contract with Backend/src/routes/petparent.vaccination.routes.ts: multer reads the one
// file from the `certificate` field and zod the strict `fullyVaccinated` text field. The page test
// mocks this module, so the wire format is held here.

const fetchMock = vi.fn<typeof fetch>();

const okJson = (): Response =>
  new Response(JSON.stringify({ bookingPetId: 'bp-max' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const lastInit = (): RequestInit => {
  const init = fetchMock.mock.calls.at(-1)?.[1];
  if (!init) throw new Error('fetch was not called with options');
  return init;
};

const bodyForm = (): FormData => {
  const body = lastInit().body;
  if (!(body instanceof FormData)) throw new Error('the body is not a FormData');
  return body;
};

const headerNames = (): string[] =>
  Object.keys(lastInit().headers ?? {}).map((name) => name.toLowerCase());

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => okJson());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveVaccination', () => {
  it('sends Yes as a multipart PUT with the certificate, the session cookie and no forced type', async () => {
    const certificate = new File(['%PDF-1.7'], 'max.pdf', { type: 'application/pdf' });

    await saveVaccination('bp max', { fullyVaccinated: true, certificate });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      'http://localhost:3000/api/petparent/vaccination/bp%20max',
    );
    expect(lastInit()).toMatchObject({ method: 'PUT', credentials: 'include' });
    expect(bodyForm().get('fullyVaccinated')).toBe('true');
    const sent = bodyForm().get('certificate');
    expect(sent).toBeInstanceOf(File);
    expect(sent instanceof File ? sent.name : null).toBe('max.pdf');
    // The browser must write the multipart type itself, with its boundary.
    expect(headerNames()).not.toContain('content-type');
  });

  it('sends No as the answer alone, with no certificate field', async () => {
    await saveVaccination('bp-max', { fullyVaccinated: false });

    expect(lastInit()).toMatchObject({ method: 'PUT', credentials: 'include' });
    expect([...bodyForm().keys()]).toEqual(['fullyVaccinated']);
    expect(bodyForm().get('fullyVaccinated')).toBe('false');
    expect(headerNames()).not.toContain('content-type');
  });
});

describe('request', () => {
  it('still sends a JSON body as application/json', async () => {
    await request('/petparent/something', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    expect(lastInit().headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(lastInit().credentials).toBe('include');
  });
});

describe('vaccinationCertificateUrl', () => {
  it('points at the owner-only certificate endpoint', () => {
    expect(vaccinationCertificateUrl('bp-max')).toBe(
      'http://localhost:3000/api/petparent/vaccination/bp-max/certificate',
    );
  });
});
