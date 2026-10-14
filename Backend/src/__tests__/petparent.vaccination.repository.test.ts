import { beforeEach, describe, expect, it, vi } from 'vitest';

// The route and service tests mock this repository whole, so these tests are what hold its SQL to
// the rules only it enforces: whose certificate a parent may read, and when a write may land.
const { queryMock, clientQueryMock, releaseMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  clientQueryMock: vi.fn(),
  releaseMock: vi.fn(),
}));
vi.mock('../config/database.js', () => ({
  pool: {
    query: queryMock,
    connect: vi.fn(async () => ({ query: clientQueryMock, release: releaseMock })),
  },
}));

import {
  findCertificateForEmployee,
  findCertificateForOwner,
  saveVaccinationAnswer,
  type VaccinationAnswerWrite,
} from '../repositories/petparent.vaccination.repository.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';
const KEY = '3f2c7a4e-1b2c-4d5e-8f90-123456789abc.pdf';
const UPLOADED_AT = new Date('2026-09-29T01:00:00.000Z');

const sqlOf = (mock: ReturnType<typeof vi.fn>, call: number): string =>
  String(mock.mock.calls[call]?.[0]).replace(/\s+/g, ' ');

const paramsOf = (mock: ReturnType<typeof vi.fn>, call: number): unknown =>
  mock.mock.calls[call]?.[1];

const WRITE: VaccinationAnswerWrite = {
  petOwnersUuid: OWNER_ID,
  bookingPetId: BOOKING_PET_ID,
  fullyVaccinated: true,
  documentKey: KEY,
  uploadedAt: UPLOADED_AT,
  openReviewStatuses: ['pending', 'approved'],
  dropOffAfter: UPLOADED_AT,
};

const statementsRun = (): string[] =>
  clientQueryMock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

beforeEach(() => {
  queryMock.mockReset();
  clientQueryMock.mockReset();
  releaseMock.mockReset();
});

describe('findCertificateForOwner', () => {
  it("reads only a certificate on the caller's own booking", async () => {
    queryMock.mockResolvedValue({ rows: [{ document_key: KEY, uploaded_at: UPLOADED_AT }] });

    const found = await findCertificateForOwner(OWNER_ID, BOOKING_PET_ID);

    expect(found).toEqual({ documentKey: KEY, uploadedAt: UPLOADED_AT });
    expect(sqlOf(queryMock, 0)).toContain('AND b.pet_owners_uuid = $2::uuid');
    expect(sqlOf(queryMock, 0)).toContain('bp.uuid = $1::uuid');
    expect(paramsOf(queryMock, 0)).toEqual([BOOKING_PET_ID, OWNER_ID]);
  });

  it('reads nothing when no row matches, as for another owner', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(findCertificateForOwner(OWNER_ID, BOOKING_PET_ID)).resolves.toBeNull();
  });
});

describe('findCertificateForEmployee', () => {
  it('reads any stay by its booking pet id alone', async () => {
    queryMock.mockResolvedValue({ rows: [{ document_key: KEY, uploaded_at: null }] });

    const found = await findCertificateForEmployee(BOOKING_PET_ID);

    expect(found).toEqual({ documentKey: KEY, uploadedAt: null });
    expect(sqlOf(queryMock, 0)).not.toContain('pet_owners_uuid');
    expect(sqlOf(queryMock, 0)).toContain('ci.vaccination_document_url IS NOT NULL');
    expect(paramsOf(queryMock, 0)).toEqual([BOOKING_PET_ID]);
  });
});

describe('saveVaccinationAnswer', () => {
  it('locks the row only for the owner, an open review status and a drop-off still to come', async () => {
    clientQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rowCount: 1, rows: [{ uuid: BOOKING_PET_ID }] };
      if (sql.includes('SELECT vaccination_document_url')) {
        return { rowCount: 1, rows: [{ document_key: 'old-key.pdf' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const result = await saveVaccinationAnswer(WRITE);

    expect(result).toEqual({ saved: true, previousDocumentKey: 'old-key.pdf' });
    const lock = sqlOf(clientQueryMock, 1);
    expect(lock).toContain('bp.uuid = $1::uuid');
    expect(lock).toContain('AND b.pet_owners_uuid = $2::uuid');
    expect(lock).toContain("AND b.status IN ('paid', 'confirmed')");
    expect(lock).toContain('AND bp.manager_review_status = ANY($3::text[])');
    expect(lock).toContain('AND bp.drop_off_time > $4');
    expect(lock).toContain('FOR UPDATE OF bp');
    expect(paramsOf(clientQueryMock, 1)).toEqual([
      BOOKING_PET_ID,
      OWNER_ID,
      ['pending', 'approved'],
      UPLOADED_AT,
    ]);
    const upsert = statementsRun().findIndex((sql) =>
      sql.startsWith('INSERT INTO booking_pets_caring_info'),
    );
    expect(paramsOf(clientQueryMock, upsert)).toEqual([BOOKING_PET_ID, true, KEY, UPLOADED_AT]);
    expect(statementsRun().at(-1)).toBe('COMMIT');
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rolls back and writes nothing when the lock finds no row', async () => {
    clientQueryMock.mockResolvedValue({ rowCount: 0, rows: [] });

    const result = await saveVaccinationAnswer(WRITE);

    expect(result).toEqual({ saved: false });
    expect(statementsRun()).toEqual(['BEGIN', expect.stringContaining('FOR UPDATE'), 'ROLLBACK']);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
