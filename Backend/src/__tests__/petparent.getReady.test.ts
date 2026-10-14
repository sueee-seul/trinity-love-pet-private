import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: queryMock } }));

import { OWNER_SAID_NEEDS_MEDICATION_NOTE } from '../common/utils/booking-care-notes.js';
import type { GetReadyTaskKey, GetReadyTaskStatus } from '../contracts/get-ready.contract.js';
import type { StayStatus } from '../contracts/stay-status.contract.js';
import {
  listGetReadyFactsForOwner,
  type GetReadyFactRow,
} from '../repositories/petparent.getReady.repository.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import {
  GET_READY_HOME_WINDOW_MS,
  buildGetReadyTasks,
  getReadyStaysForHome,
  getReadyTasksFor,
  isWithinGetReadyWindow,
  loadGetReadyFacts,
} from '../services/petparent.getReady.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const NOW = new Date('2026-10-10T09:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

const facts = (overrides: Partial<GetReadyFactRow> = {}): GetReadyFactRow => ({
  bookingPetId: 'bp-max',
  fullyVaccinated: null,
  hasVaccinationCertificate: false,
  petHasDietNotes: false,
  stayHasFeedingRoutine: false,
  petHasActiveMedication: false,
  stayHasMedicationInstructions: false,
  ownerSaidNeedsMedication: false,
  petHasEmergencyContact: false,
  ownerHasEmergencyContact: false,
  petHasVetName: false,
  petHasVetPhone: false,
  ...overrides,
});

const statusOf = (row: GetReadyFactRow, key: GetReadyTaskKey): GetReadyTaskStatus | undefined =>
  buildGetReadyTasks(row).find((task) => task.key === key)?.status;

describe('buildGetReadyTasks: the done rules', () => {
  it('lists the four tasks in a fixed order', () => {
    expect(buildGetReadyTasks(facts()).map((task) => task.key)).toEqual([
      'vaccination',
      'feeding',
      'medication',
      'emergency_contact_and_vet',
    ]);
  });

  it('vaccination proof is done only once the certificate for this stay is on file', () => {
    expect(statusOf(facts(), 'vaccination')).toBe('not_started');
    // A Yes on its own is only a claim, with no dates to check.
    expect(statusOf(facts({ fullyVaccinated: true }), 'vaccination')).toBe('not_started');
    expect(
      statusOf(facts({ fullyVaccinated: true, hasVaccinationCertificate: true }), 'vaccination'),
    ).toBe('completed');
  });

  it("feeding is done from the pet's diet notes or this stay's feeding routine", () => {
    expect(statusOf(facts(), 'feeding')).toBe('not_started');
    expect(statusOf(facts({ petHasDietNotes: true }), 'feeding')).toBe('completed');
    expect(statusOf(facts({ stayHasFeedingRoutine: true }), 'feeding')).toBe('completed');
  });

  it('medication is done when the pet takes none, or this stay says how to give it', () => {
    expect(statusOf(facts(), 'medication')).toBe('completed');
    expect(statusOf(facts({ petHasActiveMedication: true }), 'medication')).toBe('not_started');
    expect(
      statusOf(
        facts({ petHasActiveMedication: true, stayHasMedicationInstructions: true }),
        'medication',
      ),
    ).toBe('completed');
  });

  it('medication stays open when the owner told the concierge the pet needs medicine', () => {
    // The concierge's note has no medicine, dose or times, and staff alone write pet_medications,
    // so a new concierge pet has no active medicine on file either. Neither makes the task done.
    expect(statusOf(facts({ ownerSaidNeedsMedication: true }), 'medication')).toBe('not_started');
    expect(
      statusOf(
        facts({ ownerSaidNeedsMedication: true, stayHasMedicationInstructions: true }),
        'medication',
      ),
    ).toBe('completed');
  });

  it('emergency contact and vet needs a number to call and both vet details', () => {
    const vet = { petHasVetName: true, petHasVetPhone: true };
    expect(statusOf(facts(vet), 'emergency_contact_and_vet')).toBe('not_started');
    expect(
      statusOf(facts({ ...vet, ownerHasEmergencyContact: true }), 'emergency_contact_and_vet'),
    ).toBe('completed');
    expect(
      statusOf(facts({ ...vet, petHasEmergencyContact: true }), 'emergency_contact_and_vet'),
    ).toBe('completed');
    expect(
      statusOf(
        facts({ ownerHasEmergencyContact: true, petHasVetName: true }),
        'emergency_contact_and_vet',
      ),
    ).toBe('not_started');
    expect(
      statusOf(
        facts({ ownerHasEmergencyContact: true, petHasVetPhone: true }),
        'emergency_contact_and_vet',
      ),
    ).toBe('not_started');
  });
});

describe('getReadyTasksFor: approved stays only', () => {
  it('gives an approved stay that has not started its list', () => {
    expect(getReadyTasksFor('approved', facts())).toHaveLength(4);
  });

  it.each<StayStatus>(['waiting_for_review', 'refused', 'cancelled', 'staying_now', 'stay_ended'])(
    'gives no list to a stay that is %s',
    (status) => {
      expect(getReadyTasksFor(status, facts())).toBeNull();
    },
  );

  it('gives no list when the facts were read before the approval', () => {
    expect(getReadyTasksFor('approved', undefined)).toBeNull();
  });
});

describe('isWithinGetReadyWindow: 48 hours before drop-off', () => {
  const dropOff = new Date(NOW.getTime() + GET_READY_HOME_WINDOW_MS);

  it('opens exactly 48 hours before drop-off', () => {
    expect(GET_READY_HOME_WINDOW_MS).toBe(48 * HOUR_MS);
    expect(isWithinGetReadyWindow(dropOff, NOW)).toBe(true);
  });

  it('is still closed a millisecond earlier', () => {
    expect(isWithinGetReadyWindow(new Date(dropOff.getTime() + 1), NOW)).toBe(false);
  });

  it('stays open until drop-off and closes at drop-off', () => {
    expect(isWithinGetReadyWindow(new Date(NOW.getTime() + 1), NOW)).toBe(true);
    expect(isWithinGetReadyWindow(NOW, NOW)).toBe(false);
  });
});

const homeStay = (overrides: Partial<HomeStayRow>): HomeStayRow => ({
  bookingId: 'booking-1',
  bookingPetId: 'bp-max',
  reviewStatus: 'approved',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  petId: 'pet-max',
  petName: 'Max',
  petPhotoUrl: null,
  dropOffTime: new Date(NOW.getTime() + 24 * HOUR_MS),
  pickUpTime: new Date(NOW.getTime() + 96 * HOUR_MS),
  serviceType: 'Boarding',
  fullyVaccinated: null,
  hasVaccinationCertificate: false,
  vaccinationCertificateUploadedAt: null,
  hasAgreement: true,
  paymentSucceeded: true,
  ...overrides,
});

describe('getReadyStaysForHome', () => {
  it('lists approved pets inside the window, soonest drop-off first', () => {
    const luna = homeStay({
      bookingPetId: 'bp-luna',
      petId: 'pet-luna',
      petName: 'Luna',
      dropOffTime: new Date(NOW.getTime() + 2 * HOUR_MS),
    });
    const factsByStay = new Map([
      ['bp-max', facts({ petHasDietNotes: true })],
      ['bp-luna', facts({ bookingPetId: 'bp-luna' })],
    ]);

    const cards = getReadyStaysForHome([homeStay({}), luna], factsByStay, NOW);

    expect(cards.map((card) => card.petName)).toEqual(['Luna', 'Max']);
    expect(cards[1]).toEqual({
      bookingPetId: 'bp-max',
      bookingId: 'booking-1',
      petId: 'pet-max',
      petName: 'Max',
      dropOffAt: new Date(NOW.getTime() + 24 * HOUR_MS).toISOString(),
      tasks: buildGetReadyTasks(facts({ petHasDietNotes: true })),
    });
  });

  it('leaves out a pet whose drop-off is more than 48 hours away', () => {
    const later = homeStay({ dropOffTime: new Date(NOW.getTime() + 48 * HOUR_MS + 1) });
    expect(getReadyStaysForHome([later], new Map([['bp-max', facts()]]), NOW)).toEqual([]);
  });

  it('leaves out a pet the manager has not approved, even inside the window', () => {
    const factsByStay = new Map([['bp-max', facts()]]);
    for (const reviewStatus of ['pending', 'refused', 'cancelled'] as const) {
      expect(getReadyStaysForHome([homeStay({ reviewStatus })], factsByStay, NOW)).toEqual([]);
    }
  });
});

describe('listGetReadyFactsForOwner', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reads only the caller's own approved stays that have not started", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listGetReadyFactsForOwner(OWNER_ID, NOW);

    const sql = String(queryMock.mock.calls[0]?.[0]).replace(/\s+/g, ' ');
    expect(queryMock.mock.calls[0]?.[1]).toEqual([OWNER_ID, NOW, OWNER_SAID_NEEDS_MEDICATION_NOTE]);
    expect(sql).toContain('b.pet_owners_uuid = $1::uuid');
    expect(sql).toContain('p.pet_owners_uuid = $1::uuid');
    expect(sql).toContain("bp.manager_review_status = 'approved'");
    expect(sql).toContain('bp.drop_off_time > $2');
  });

  it("never counts the concierge's medication note as the stay's instructions", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listGetReadyFactsForOwner(OWNER_ID, NOW);

    const sql = String(queryMock.mock.calls[0]?.[0]).replace(/\s+/g, ' ');
    expect(sql).toContain(
      "( NULLIF(btrim(ci.medication_instructions), '') IS NOT NULL AND btrim(ci.medication_instructions) <> $3 ) AS stay_has_medication_instructions",
    );
    expect(sql).toContain(
      'COALESCE(btrim(ci.medication_instructions) = $3, false) AS owner_said_needs_medication',
    );
  });

  it('keys the yes or no facts by booking pet', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          booking_pet_id: 'bp-max',
          fully_vaccinated: true,
          has_vaccination_certificate: true,
          pet_has_diet_notes: false,
          stay_has_feeding_routine: true,
          pet_has_active_medication: true,
          stay_has_medication_instructions: false,
          owner_said_needs_medication: true,
          pet_has_emergency_contact: false,
          owner_has_emergency_contact: true,
          pet_has_vet_name: true,
          pet_has_vet_phone: false,
        },
      ],
    });

    const byStay = await loadGetReadyFacts(OWNER_ID, NOW);

    expect(byStay.get('bp-max')).toEqual(
      facts({
        fullyVaccinated: true,
        hasVaccinationCertificate: true,
        stayHasFeedingRoutine: true,
        petHasActiveMedication: true,
        ownerSaidNeedsMedication: true,
        ownerHasEmergencyContact: true,
        petHasVetName: true,
      }),
    );
  });
});
