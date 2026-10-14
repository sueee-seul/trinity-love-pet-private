import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatTaskTime,
  MAX_TASK_PHOTOS,
  type Task,
  type TaskTimeStyle,
} from '../../types/task.types';
import { TaskMediaInput } from './TaskMediaInput';
import { TaskPhotoLinks } from './TaskPhotoLinks';
import { badgeClass } from './taskDashboard.helpers';

const UploadIcon = (): ReactElement => (
  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type TaskDashboardRowProps = {
  task: Task;
  showActions: boolean;
  timeStyle: TaskTimeStyle;
  onEdit: () => void;
  onComplete: () => void;
  onUploadPhoto: (files: File[]) => void;
  onDeletePhoto: (storedName: string) => void;
};

export function TaskDashboardRow({
  task,
  showActions,
  timeStyle,
  onEdit,
  onComplete,
  onUploadPhoto,
  onDeletePhoto,
}: TaskDashboardRowProps): ReactElement {
  const navigate = useNavigate();

  return (
    <tr className="cursor-pointer transition hover:bg-surface-card" onClick={onEdit}>
      <td className="px-2.5 py-3 text-notice-secondary">
        {task.task_type === 'staff' ? 'Staff task' : 'Pet task'}
      </td>
      <td className="px-2.5 py-3 font-semibold text-notice-primary">
        {task.title}{' '}
        {task.pet_id ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/admin/pets/${task.pet_id}`);
            }}
            className="font-semibold text-notice-muted transition-colors hover:text-notice-secondary hover:underline"
          >
            ({task.pet_name})
          </button>
        ) : (
          <span className="text-notice-muted">({task.pet_name})</span>
        )}
      </td>
      <td className="px-2.5 py-3">{task.owner_name}</td>
      <td className="whitespace-nowrap px-2.5 py-3">
        <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeClass(task.status)}`}>
          {task.status}
        </span>
        {task.overdue && (
          <span className="ml-1 rounded bg-status-danger-soft px-1.5 py-0.5 font-semibold text-status-danger">
            overdue
          </span>
        )}
      </td>
      <td className="px-2.5 py-3">
        <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeClass(task.priority)}`}>
          {task.priority}
        </span>
      </td>
      <td className="whitespace-nowrap px-2.5 py-3">
        {formatTaskTime(task.due_datetime, timeStyle)}
      </td>
      <td className="max-w-42 truncate px-2.5 py-3">{task.description || 'None'}</td>
      <td className="max-w-36 truncate px-2.5 py-3">{task.issue || 'None'}</td>
      <td className="px-2.5 py-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <TaskPhotoLinks task={task} onDelete={onDeletePhoto} />
          {(task.photos?.length ?? 0) < MAX_TASK_PHOTOS && (
            <label
              title={task.photos?.length ? 'Add photo or video' : 'Upload photo or short video'}
              className="flex cursor-pointer items-center rounded bg-surface-cream p-1.5 text-notice-secondary hover:bg-surface-deep"
            >
              <UploadIcon />
              <TaskMediaInput onFiles={onUploadPhoto} />
            </label>
          )}
        </div>
      </td>
      <td className="px-2.5 py-3">
        {showActions && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComplete();
            }}
            className="rounded bg-action-dark px-2 py-1 font-semibold text-on-action-dark hover:bg-action-dark"
          >
            Mark done
          </button>
        )}
      </td>
    </tr>
  );
}
