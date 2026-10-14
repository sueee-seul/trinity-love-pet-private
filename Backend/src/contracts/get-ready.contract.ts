/**
 * The "Get ready" list a pet parent works through before drop-off, one per approved booking pet.
 * Built from rows that already exist (services/petparent.getReady.ts), so no column records it.
 * Mirrored by Frontend/src/features/pet-parent/types/getReady.ts.
 */

/**
 * The tasks, in the order the list shows them. Behaviour and allergies is not one: nothing records
 * that a parent confirmed "none", so a calm pet with no allergies could never complete it.
 */
export type GetReadyTaskKey =
  'vaccination' | 'feeding' | 'medication' | 'emergency_contact_and_vet';

/** The GOV.UK task list statuses: a task is either done or not started. */
export type GetReadyTaskStatus = 'completed' | 'not_started';

export interface GetReadyTask {
  key: GetReadyTaskKey;
  status: GetReadyTaskStatus;
}

/** An approved stay whose drop-off is at most 48 hours away, for the Home "Get ready" card. */
export interface GetReadyStay {
  bookingPetId: string;
  bookingId: string;
  petId: string;
  petName: string;
  dropOffAt: string;
  tasks: GetReadyTask[];
}
