import { useId, type ReactElement } from 'react';
import { DateField, TimeField } from '../../../../shared/components/ui/date';
import type { ShiftStaffOption } from '../../api/staffShiftApi';
import type { Draft } from './shiftDraft';

const inputClass =
  'w-full rounded border border-field-border bg-surface-card px-3 py-2 type-body outline-none focus:border-focus';
// A TimeField is a select with its own chevron, so the native arrow is hidden and room is left for it.
const timeClass = `${inputClass} appearance-none pr-10`;
// Staff can start early or finish late, so the whole day is offered in quarter hours.
const SHIFT_STEP_MINUTES = 15;
const labelClass = 'mb-1 block type-meta font-semibold uppercase tracking-wide text-notice-muted';

export function ShiftFormFields({
  draft,
  staff,
  onPatch,
}: {
  draft: Draft;
  staff: ShiftStaffOption[];
  onPatch: (next: Partial<Draft>) => void;
}): ReactElement {
  const dateId = useId();
  const startId = useId();
  const finishId = useId();
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Staff</label>
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
      </div>
      <div>
        {/* The date trigger is a button, so it is named only by a label that points at it. */}
        <label htmlFor={dateId} className={labelClass}>
          Date
        </label>
        <DateField
          id={dateId}
          locale="en"
          value={draft.date}
          onChange={(date) => onPatch({ date })}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={startId} className={labelClass}>
            Start *
          </label>
          <TimeField
            id={startId}
            required
            locale="en"
            stepMinutes={SHIFT_STEP_MINUTES}
            value={draft.start}
            onChange={(start) => onPatch({ start })}
            className={timeClass}
          />
        </div>
        <div>
          <label htmlFor={finishId} className={labelClass}>
            Finish *
          </label>
          <TimeField
            id={finishId}
            required
            locale="en"
            stepMinutes={SHIFT_STEP_MINUTES}
            value={draft.finish}
            onChange={(finish) => onPatch({ finish })}
            className={timeClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Issue</label>
        <input
          value={draft.issue}
          onChange={(event) => onPatch({ issue: event.target.value })}
          placeholder="None"
          className={inputClass}
        />
      </div>
    </div>
  );
}
