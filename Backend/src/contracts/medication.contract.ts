/**
 * The dose record a stay keeps. Nothing is confirmed to the parent unless the dose task was ticked.
 */

/** A dose is "late" this long after its slot time (owner decision O9). */
export const MEDICATION_DOSE_WINDOW_MINUTES = 60;

/** What happened to one dose, read from its care task. */
export type DoseStatus = 'due' | 'overdue' | 'given' | 'not_given' | 'not_recorded';

export interface DoseRecord {
  id: string;
  medicationId: string;
  medicineName: string;
  dose: number;
  unit: string;
  slot: string;
  /** ISO instant the dose is due. */
  dueAt: string;
  status: DoseStatus;
  /** ISO instant staff ticked it, when given. */
  givenAt: string | null;
  /** The staff member's display name, when the task names one. */
  givenBy: string | null;
  /** Why it was not given, when staff recorded that. */
  reason: string | null;
}
