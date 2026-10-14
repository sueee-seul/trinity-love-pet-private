import {
  MEDICATION_DOSE_WINDOW_MINUTES,
  type DoseRecord,
  type DoseStatus,
} from '../contracts/medication.contract.js';
import type { AdministrationRow } from '../repositories/medication.administration.repository.js';

/**
 * One dose as the daily update and the stay report read it (Scenario 11 outcome 6). A dose is
 * "given" only when staff ticked its task; "due" until its window passes, "overdue" after that,
 * "not_given" when staff cancelled the task (their issue says why), and "not_recorded" when the
 * task is gone. Nothing here guesses: a dose without a tick is never called given.
 */

const MS_PER_MINUTE = 60_000;

export const doseStatusOf = (row: AdministrationRow, now: Date): DoseStatus => {
  if (row.taskStatus === null) return 'not_recorded';
  if (row.taskStatus === 'completed') return 'given';
  if (row.taskStatus === 'cancelled') return 'not_given';
  const windowEnd = row.scheduledFor.getTime() + MEDICATION_DOSE_WINDOW_MINUTES * MS_PER_MINUTE;
  return now.getTime() > windowEnd ? 'overdue' : 'due';
};

export const toDoseRecord = (row: AdministrationRow, now: Date): DoseRecord => {
  const status = doseStatusOf(row, now);
  return {
    id: row.id,
    medicationId: row.medicationId,
    medicineName: row.medicineName,
    dose: row.dose,
    unit: row.unit,
    slot: row.slot,
    dueAt: row.scheduledFor.toISOString(),
    status,
    givenAt: status === 'given' && row.completedAt ? row.completedAt.toISOString() : null,
    givenBy: status === 'given' ? row.staffName : null,
    reason: status === 'not_given' ? row.issue : null,
  };
};
