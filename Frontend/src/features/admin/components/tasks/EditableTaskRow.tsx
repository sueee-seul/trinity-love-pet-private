import type { ReactElement } from 'react';
import { DateTimeField } from '../../../../shared/components/ui/date';
import {
  snapTimeInputTo10,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskDraft,
} from '../../types/task.types';
import { TaskPhotoLinks } from './TaskPhotoLinks';

// Task times are kept on a ten minute grid, the same grid snapTimeInputTo10 rounds to.
const TASK_STEP_MINUTES = 10;

type EditableTaskRowProps = {
  task: Task;
  draft: TaskDraft;
  onChange: (values: Partial<TaskDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function EditableTaskRow({
  task,
  draft,
  onChange,
  onSave,
  onCancel,
}: EditableTaskRowProps): ReactElement {
  const fieldClass = 'w-full rounded border border-field-border bg-surface-card p-1 type-meta';
  return (
    <tr className="bg-surface-card">
      <td className="p-1">
        <select
          value={draft.taskType}
          onChange={(event) => onChange({ taskType: event.target.value as Task['task_type'] })}
          className={fieldClass}
        >
          <option value="staff">Staff task</option>
          <option value="pet">Pet task</option>
        </select>
      </td>
      <td className="p-1">
        <input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className={fieldClass}
        />
      </td>
      <td className="px-2.5 py-3">{task.owner_name}</td>
      <td className="p-1">
        <select
          value={draft.status}
          onChange={(event) => onChange({ status: event.target.value as Task['status'] })}
          className={fieldClass}
        >
          {TASK_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </td>
      <td className="p-1">
        <select
          value={draft.priority}
          onChange={(event) => onChange({ priority: event.target.value as Task['priority'] })}
          className={fieldClass}
        >
          {TASK_PRIORITIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </td>
      <td className="p-1">
        <DateTimeField
          locale="en"
          stepMinutes={TASK_STEP_MINUTES}
          fieldClassName={fieldClass}
          value={draft.time}
          onChange={(time) => onChange({ time: snapTimeInputTo10(time) })}
        />
      </td>
      <td className="p-1">
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={fieldClass}
        />
      </td>
      <td className="p-1">
        <input
          value={draft.issue}
          onChange={(event) => onChange({ issue: event.target.value })}
          className={fieldClass}
        />
      </td>
      <td className="p-1">
        {task.photos?.length ? (
          <TaskPhotoLinks task={task} />
        ) : (
          <span className="text-notice-muted">No photo</span>
        )}
      </td>
      <td className="whitespace-nowrap p-1">
        <button
          type="button"
          onClick={onSave}
          className="mr-1 rounded bg-action-dark px-2 py-1 font-semibold text-on-action-dark"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-surface-cream px-2 py-1 font-semibold text-notice-secondary"
        >
          Cancel
        </button>
      </td>
    </tr>
  );
}
