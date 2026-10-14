import type { ReactElement } from 'react';
import {
  formatTaskTime,
  MAX_TASK_PHOTOS,
  type Task,
  type TaskTimeStyle,
} from '../../types/task.types';
import { TaskMediaInput } from './TaskMediaInput';
import { TaskPhotoLinks } from './TaskPhotoLinks';

type TaskTableProps = {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onAdd: () => void;
  onUploadPhoto: (taskId: string, files: File[]) => void;
  onDeletePhoto: (taskId: string, storedName: string) => void;
  timeStyle?: TaskTimeStyle;
};

export function TaskTable({
  tasks,
  onEdit,
  onAdd,
  onUploadPhoto,
  onDeletePhoto,
  timeStyle = 'time',
}: TaskTableProps): ReactElement {
  return (
    <table className="w-full min-w-[900px] text-left type-meta">
      <thead className="bg-surface-card type-eyebrow uppercase tracking-wide text-notice-secondary">
        <tr>
          {[
            'Type',
            'Task',
            'Status',
            'Priority',
            'Time',
            'Assigned Staff',
            'Description',
            'Issue',
            'Photo',
            'Edit',
          ].map((item) => (
            <th key={item} className="px-2.5 py-2">
              {item}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft">
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className="px-2.5 py-2">
              {task.task_type === 'staff' ? 'Staff task' : 'Pet task'}
            </td>
            <td className="px-2.5 py-2 font-semibold">{task.title}</td>
            <td className="whitespace-nowrap px-2.5 py-2">
              {task.status}
              {task.overdue && (
                <span className="ml-1 rounded bg-status-danger-soft px-1 py-0.5 font-semibold text-status-danger">
                  overdue
                </span>
              )}
            </td>
            <td className="px-2.5 py-2">{task.priority}</td>
            <td className="whitespace-nowrap px-2.5 py-2">
              {formatTaskTime(task.due_datetime, timeStyle)}
            </td>
            <td className="px-2.5 py-2">{task.staff_name}</td>
            <td className="px-2.5 py-2">{task.description || 'None'}</td>
            <td className="px-2.5 py-2">{task.issue || 'None'}</td>
            <td className="px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                {task.photos?.length ? (
                  <TaskPhotoLinks
                    task={task}
                    onDelete={(storedName) => onDeletePhoto(task.id, storedName)}
                  />
                ) : (
                  <span className="text-notice-muted">No photo</span>
                )}
                {(task.photos?.length ?? 0) < MAX_TASK_PHOTOS && (
                  <label className="cursor-pointer rounded bg-surface-cream px-2 py-1 font-semibold text-notice-secondary">
                    {task.photos?.length ? 'Add' : '+ Photo or video'}
                    <TaskMediaInput onFiles={(files) => onUploadPhoto(task.id, files)} />
                  </label>
                )}
              </div>
            </td>
            <td className="px-2.5 py-2">
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="rounded bg-surface-cream px-2 py-1 font-semibold text-notice-secondary"
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={10} className="p-2">
            <button
              type="button"
              onClick={onAdd}
              className="w-full border border-dashed border-border-soft py-2 text-left"
            >
              + Add task in this profile
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
