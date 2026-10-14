import React, { useId, useState } from 'react';
import { DateField, TimeField } from '../../../../shared/components/ui/date';
import type { CreatePetAssignmentInput } from '../../api/petApi';
import type { PetAssignment } from '../../types/pet';
import type { StaffOption } from '../../types/feedback';

interface PetAssignmentEditorProps {
  assignments: PetAssignment[];
  staffOptions: StaffOption[];
  loading: boolean;
  error: string | null;
  onCreate: (input: CreatePetAssignmentInput) => Promise<void>;
  onDelete: (assignmentUuid: string) => Promise<void>;
}

const inputClassName =
  'mt-1 w-full rounded border border-field-border bg-surface-card px-1.5 py-1 type-meta font-semibold text-notice-primary outline-none focus:border-control-border disabled:cursor-not-allowed disabled:opacity-50';

// A TimeField is a select with its own chevron, so the native arrow is hidden and room is left for the chevron.
const timeClassName = `${inputClassName} appearance-none pr-7`;

// Staff can start early or finish late, so the whole day is offered in quarter hours.
const SHIFT_STEP_MINUTES = 15;

const formatShift = (assignment: PetAssignment): string => {
  if (assignment.shiftStart === null || assignment.shiftEnd === null) {
    return 'All day';
  }
  return `${assignment.shiftStart.slice(0, 5)} to ${assignment.shiftEnd.slice(0, 5)}`;
};

export const PetAssignmentEditor: React.FC<PetAssignmentEditorProps> = ({
  assignments,
  staffOptions,
  loading,
  error,
  onCreate,
  onDelete,
}) => {
  const dateFieldId = useId();
  const shiftStartId = useId();
  const shiftEndId = useId();
  const [employeeUuid, setEmployeeUuid] = useState('');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const isComplete =
    employeeUuid !== '' &&
    assignmentDate !== '' &&
    (allDay || (shiftStart !== '' && shiftEnd !== ''));

  const handleCreate = async (): Promise<void> => {
    if (!isComplete) {
      return;
    }

    setIsSaving(true);
    setMutationError(null);
    try {
      await onCreate({
        employeeUuid,
        assignmentDate,
        shiftStart: allDay ? null : shiftStart,
        shiftEnd: allDay ? null : shiftEnd,
      });
      setAssignmentDate('');
      setShiftStart('');
      setShiftEnd('');
      setAllDay(false);
    } catch (saveError) {
      console.error('Failed to create pet assignment', saveError);
      setMutationError('Unable to save this assignment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (assignmentUuid: string): Promise<void> => {
    if (!window.confirm('Remove this pet assignment?')) {
      return;
    }

    setDeletingUuid(assignmentUuid);
    setMutationError(null);
    try {
      await onDelete(assignmentUuid);
    } catch (deleteError) {
      console.error('Failed to delete pet assignment', deleteError);
      setMutationError('Unable to remove this assignment. Please try again.');
    } finally {
      setDeletingUuid(null);
    }
  };

  return (
    <div className="mt-4 border-t border-border-soft pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="type-eyebrow font-bold uppercase tracking-wide text-notice-secondary">
          Pet assignments
        </p>
        <span className="type-meta text-notice-secondary">Date and shift are required</span>
      </div>

      {(error || mutationError) && (
        <p role="alert" className="mb-2 type-meta font-semibold text-status-danger">
          {mutationError ?? error}
        </p>
      )}

      {loading ? (
        <p className="type-meta text-notice-secondary">Loading assignments…</p>
      ) : assignments.length === 0 ? (
        <p className="mb-3 type-meta text-notice-secondary">
          No assignments recorded for this pet.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5" aria-label="Current pet assignments">
          {assignments.map((assignment) => (
            <li
              key={assignment.uuid}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-card px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate type-meta font-semibold text-notice-primary">
                  {assignment.employeeName}
                </p>
                <p className="type-meta text-notice-secondary">
                  {assignment.assignmentDate} · {formatShift(assignment)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(assignment.uuid)}
                disabled={deletingUuid !== null}
                className="shrink-0 rounded px-1.5 py-1 type-meta font-semibold text-notice-secondary hover:bg-surface-cream disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingUuid === assignment.uuid ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="type-eyebrow font-bold uppercase text-notice-secondary">
          Staff
          <select
            aria-label="Assignment staff"
            value={employeeUuid}
            onChange={(event) => setEmployeeUuid(event.target.value)}
            className={inputClassName}
            disabled={isSaving || staffOptions.length === 0}
          >
            <option value="">Select staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </label>
        <div className="type-eyebrow font-bold uppercase text-notice-secondary">
          {/* The date trigger is a button, named only by a label that points at it. The short
              word is what sighted users see; the longer name is the one screen readers hear. */}
          <label htmlFor={dateFieldId}>
            <span aria-hidden="true">Date</span>
            <span className="sr-only">Assignment date</span>
          </label>
          <DateField
            id={dateFieldId}
            locale="en"
            value={assignmentDate}
            onChange={setAssignmentDate}
            className={inputClassName}
            disabled={isSaving}
          />
        </div>
        {/* Divs, not wrapping labels, for both times: the field puts its select inside a div,
            which a label cannot hold. */}
        <div className="type-eyebrow font-bold uppercase text-notice-secondary">
          <label htmlFor={shiftStartId}>Start</label>
          <TimeField
            id={shiftStartId}
            aria-label="Assignment shift start"
            locale="en"
            stepMinutes={SHIFT_STEP_MINUTES}
            value={shiftStart}
            onChange={setShiftStart}
            className={timeClassName}
            disabled={isSaving || allDay}
          />
        </div>
        <div className="type-eyebrow font-bold uppercase text-notice-secondary">
          <label htmlFor={shiftEndId}>End</label>
          <TimeField
            id={shiftEndId}
            aria-label="Assignment shift end"
            locale="en"
            stepMinutes={SHIFT_STEP_MINUTES}
            value={shiftEnd}
            onChange={setShiftEnd}
            className={timeClassName}
            disabled={isSaving || allDay}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1 type-meta font-semibold text-notice-secondary">
          <input
            aria-label="All day assignment"
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            disabled={isSaving}
          />
          All day
        </label>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!isComplete || isSaving}
          className="rounded bg-action-dark px-2 py-1 type-meta font-semibold text-on-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Add assignment'}
        </button>
      </div>
    </div>
  );
};
