import type { ReactElement } from 'react';
import type { Task } from '../../types/task.types';
import { TaskEditorFields, type TaskEditorFieldValues } from './TaskEditorFields';

type TaskEditorFormProps = TaskEditorFieldValues & {
  task: Task | null;
  canSave: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function TaskEditorForm({
  task,
  canSave,
  onClose,
  onDelete,
  onSave,
  ...fields
}: TaskEditorFormProps): ReactElement {
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-border-soft bg-surface-card p-3 sm:grid-cols-2">
      <TaskEditorFields {...fields} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-surface-cream px-3 py-1.5 type-meta"
        >
          Cancel
        </button>
        {task && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-status-danger-soft px-3 py-1.5 type-meta font-semibold text-status-danger"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="rounded bg-action-dark px-3 py-1.5 type-meta font-semibold text-on-action-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
