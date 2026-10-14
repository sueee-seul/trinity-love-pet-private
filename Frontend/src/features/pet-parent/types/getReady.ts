// The "Get ready" list before drop-off, one per approved booking pet.
// Mirrors Backend/src/contracts/get-ready.contract.ts.

/** The tasks, in the order the server sends them. Behaviour and allergies is not one: nothing
 * records that a parent confirmed "none", so that task could never be completed. */
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
