// Words and links for the "Get ready" list. The server decides each task's status
// (Backend/src/services/petparent.getReady.ts); the pages only name it and point to the page that
// holds the detail, so the same task never reads two ways. The words are in getReadyCopy.ts; the
// 'en' locale default keeps callers that do not pass one reading English.
import type { PortalLocale } from '../../i18n/portalLocale';
import type { GetReadyTask, GetReadyTaskKey, GetReadyTaskStatus } from '../../types/getReady';
import type { PetStay } from '../../types/stays';
import { GET_READY_COPY } from './getReadyCopy';

/** Which pet and which stay a list belongs to, for the words and the links. */
export interface GetReadyTarget {
  bookingPetId: string;
  /** Null when the pet's profile was deleted; then there is no pet page to link to. */
  petId: string | null;
  petName: string;
}

export function getReadyTargetOf(stay: PetStay): GetReadyTarget {
  return { bookingPetId: stay.bookingPetId, petId: stay.pet.id, petName: stay.pet.name };
}

export interface GetReadyTaskView {
  key: GetReadyTaskKey;
  label: string;
  hint: string;
  /** Where the parent does the task, or null when only our team can finish it. */
  to: string | null;
  status: GetReadyTaskStatus;
}

/**
 * An open medication task is one the parent cannot finish here: staff alone record a pet's
 * medicines (the pet page lists them read-only), and a stay's care notes cannot be changed after
 * the request. So the row says our team does it with them, and links nowhere.
 */
const teamFinishes = (task: GetReadyTask): boolean =>
  task.key === 'medication' && task.status === 'not_started';

// Each hint reads true whether the task is done or not, except the one only our team can finish.
const taskHint = (task: GetReadyTask, petName: string, locale: PortalLocale): string => {
  const copy = GET_READY_COPY[locale];
  switch (task.key) {
    case 'vaccination':
      return copy.vaccinationHint;
    case 'feeding':
      return copy.feedingHint(petName);
    case 'medication':
      return teamFinishes(task) ? copy.medicationByTeamHint(petName) : copy.medicationHint(petName);
    case 'emergency_contact_and_vet':
      return copy.emergencyContactHint;
  }
};

// The vaccination proof belongs to this stay; every other detail lives on the pet's own page.
const taskLink = (task: GetReadyTask, target: GetReadyTarget): string | null => {
  if (teamFinishes(task)) return null;
  if (task.key === 'vaccination') return `/parent/vaccination/${target.bookingPetId}`;
  return target.petId ? `/parent/pets/${target.petId}` : null;
};

export function getReadyTaskViews(
  tasks: GetReadyTask[],
  target: GetReadyTarget,
  locale: PortalLocale = 'en',
): GetReadyTaskView[] {
  return tasks.map((task) => ({
    key: task.key,
    label: GET_READY_COPY[locale].taskLabels[task.key],
    hint: taskHint(task, target.petName, locale),
    to: taskLink(task, target),
    status: task.status,
  }));
}

/** "2 of 4 done" */
export function getReadyProgress(tasks: GetReadyTask[], locale: PortalLocale = 'en'): string {
  const done = tasks.filter((task) => task.status === 'completed').length;
  return GET_READY_COPY[locale].progress(done, tasks.length);
}

/** "Get ready, 2 of 4 done", the words on the My stays card. */
export function getReadyButtonLabel(tasks: GetReadyTask[], locale: PortalLocale = 'en'): string {
  return GET_READY_COPY[locale].buttonLabel(getReadyProgress(tasks, locale));
}

export function hasOpenTasks(tasks: GetReadyTask[]): boolean {
  return tasks.some((task) => task.status === 'not_started');
}

/**
 * What happens at the desk. Staff check the vaccination proof and the pet's health and behaviour
 * when the pet arrives (Code of Welfare MS 4(a), 6(b)); a pet without proof is kept apart (MS 4(c),
 * 6(a)), in the same words the concierge uses. The concierge's "Before drop-off" list names the
 * temperament and bite history as something our team goes through with the parent, and nothing
 * in the app collects it, so the list says it happens here. Current online bookings record vet
 * consent in their versioned agreement; older bookings may need a signature. The notice for a
 * new contact or vet sits by those fields on the profile forms, where the details are collected.
 */
export function dropOffChecks(petName: string, locale: PortalLocale = 'en'): string[] {
  return GET_READY_COPY[locale].dropOffChecks(petName);
}
