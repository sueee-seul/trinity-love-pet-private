import { useId, type ReactElement } from 'react';
import { DateField, TimeField } from '../../../../shared/components/ui/date';
import type { ShiftStaffOption } from '../../api/staffShiftApi';
import type { Draft } from './shiftDraft';

const inputClass =
  'w-full rounded border border-field-border bg-surface-card px-2 py-1 type-body outline-none focus:border-focus';
// A TimeField is a select with its own chevron, so the native arrow is hidden and room is left for it.
const timeClass = `${inputClass} appearance-none pr-9`;
// Staff can start early or finish late, so the whole day is offered in quarter hours.
const SHIFT_STEP_MINUTES = 15;

/** The five editable cells of one shift row (staff, date, start, finish, issue),
 * shared by the inline edit row and the "add" row. */
export function ShiftRowFields({
  draft,
  staff,
  onPatch,
}: {
  draft: Draft;
  staff: ShiftStaffOption[];
  onPatch: (next: Partial<Draft>) => void;
}): ReactElement {
  const dateId = useId();
  return (
    <>
      <td className="py-2 pr-3">
        <select
          value={draft.staffId}
          onChange={(event) => onPatch({ staffId: event.target.value })}
          className={inputClass}
        >
          <option value="">Select staff</option>
          {staff.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.staff_status !== 'active' ? ` (${option.staff_status})` : ''}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        {/* The column header names the cell for sighted users. The date trigger is a button, and
            only a label that points at it gives it a name, so a hidden one is added here. */}
        <label htmlFor={dateId} className="sr-only">
          Shift date
        </label>
        <DateField
          id={dateId}
          locale="en"
          value={draft.date}
          onChange={(date) => onPatch({ date })}
          className={inputClass}
        />
      </td>
      <td className="py-2 pr-3">
        <TimeField
          required
          aria-label="Shift start"
          locale="en"
          stepMinutes={SHIFT_STEP_MINUTES}
          value={draft.start}
          onChange={(start) => onPatch({ start })}
          className={timeClass}
        />
      </td>
      <td className="py-2 pr-3">
        <TimeField
          required
          aria-label="Shift finish"
          locale="en"
          stepMinutes={SHIFT_STEP_MINUTES}
          value={draft.finish}
          onChange={(finish) => onPatch({ finish })}
          className={timeClass}
        />
      </td>
      <td className="py-2 pr-3">
        <input
          value={draft.issue}
          onChange={(event) => onPatch({ issue: event.target.value })}
          placeholder="None"
          className={inputClass}
        />
      </td>
    </>
  );
}
