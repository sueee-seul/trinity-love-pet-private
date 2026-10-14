import type {
  GetReadyStay,
  GetReadyTask,
  GetReadyTaskStatus,
} from '../contracts/get-ready.contract.js';
import type { StayStatus } from '../contracts/stay-status.contract.js';
import {
  listGetReadyFactsForOwner,
  type GetReadyFactRow,
} from '../repositories/petparent.getReady.repository.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import { vaccinationStatusOf } from './petparent.home.logic.js';
import { toStayStatus } from './stay-status.js';

// The "Get ready" list before drop-off. Every status is worked out when the page is read, from
// rows that already exist, so nothing is stored and no job has to run for it. My stays and the
// booking details show it from approval; Home adds a card for it from 48 hours before drop-off.

/** Home shows the "Get ready" card from this long before drop-off (owner decision, 2026-09-29). */
export const GET_READY_HOME_WINDOW_MS = 48 * 60 * 60 * 1000;

export type GetReadyFactsByStay = ReadonlyMap<string, GetReadyFactRow>;

const statusWhen = (done: boolean): GetReadyTaskStatus => (done ? 'completed' : 'not_started');

/**
 * The done rules, one per task, always in this order. Pure, so each rule is tested without a
 * database.
 * - Vaccination proof: the certificate for this stay is on file (the Home checklist's rule).
 * - Feeding: the pet's page has diet notes, or this stay has a feeding routine.
 * - Medication: this stay has instructions for it, or the pet has no active medicine on file and
 *   the owner did not tell the concierge it needs some (that note carries no medicine, dose or
 *   times, so staff still have to get them).
 * - Emergency contact and vet: a number to call, on the pet or on the account, plus the vet's
 *   name and phone.
 */
export const buildGetReadyTasks = (facts: GetReadyFactRow): GetReadyTask[] => [
  { key: 'vaccination', status: statusWhen(vaccinationStatusOf(facts) === 'done') },
  { key: 'feeding', status: statusWhen(facts.petHasDietNotes || facts.stayHasFeedingRoutine) },
  {
    key: 'medication',
    status: statusWhen(
      facts.stayHasMedicationInstructions ||
        (!facts.petHasActiveMedication && !facts.ownerSaidNeedsMedication),
    ),
  },
  {
    key: 'emergency_contact_and_vet',
    status: statusWhen(
      (facts.petHasEmergencyContact || facts.ownerHasEmergencyContact) &&
        facts.petHasVetName &&
        facts.petHasVetPhone,
    ),
  },
];

/**
 * The list exists only for an approved stay that has not started: a request still waiting,
 * refused or cancelled is not a booking, and from drop-off staff take over at the desk. A stay the
 * manager approved after the facts were read has none yet and gets its list on the next read.
 */
export const getReadyTasksFor = (
  status: StayStatus,
  facts: GetReadyFactRow | undefined,
): GetReadyTask[] | null => (status === 'approved' && facts ? buildGetReadyTasks(facts) : null);

/** From exactly 48 hours before drop-off until drop-off itself. */
export const isWithinGetReadyWindow = (dropOff: Date, now: Date): boolean => {
  const untilDropOff = dropOff.getTime() - now.getTime();
  return untilDropOff > 0 && untilDropOff <= GET_READY_HOME_WINDOW_MS;
};

/** The Home cards: each approved pet whose drop-off is within the window, soonest first. */
export const getReadyStaysForHome = (
  stays: HomeStayRow[],
  factsByStay: GetReadyFactsByStay,
  now: Date,
): GetReadyStay[] =>
  stays
    .filter((stay) => isWithinGetReadyWindow(stay.dropOffTime, now))
    .flatMap((stay): GetReadyStay[] => {
      const tasks = getReadyTasksFor(toStayStatus(stay, now), factsByStay.get(stay.bookingPetId));
      if (!tasks) return [];
      return [
        {
          bookingPetId: stay.bookingPetId,
          bookingId: stay.bookingId,
          petId: stay.petId,
          petName: stay.petName,
          dropOffAt: stay.dropOffTime.toISOString(),
          tasks,
        },
      ];
    })
    .sort((a, b) => Date.parse(a.dropOffAt) - Date.parse(b.dropOffAt));

export const loadGetReadyFacts = async (
  petOwnersUuid: string,
  now: Date,
): Promise<GetReadyFactsByStay> => {
  const rows = await listGetReadyFactsForOwner(petOwnersUuid, now);
  return new Map(rows.map((row) => [row.bookingPetId, row]));
};
