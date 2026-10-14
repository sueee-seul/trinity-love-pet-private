import type { ReactElement } from 'react';
import type { Task, TaskTimeStyle } from '../../types/task.types';
import { EditableTaskRow } from './EditableTaskRow';
import { TaskDashboardRow } from './TaskDashboardRow';
import { useTaskDashboardTable } from './useTaskDashboardTable';

type TaskDashboardTableProps = {
  tasks: Task[];
  showActions: boolean;
  onReload: () => void;
  timeStyle?: TaskTimeStyle;
};

const HEADERS = [
  'Type',
  'Task',
  'Owner',
  'Status',
  'Priority',
  'Time',
  'Description',
  'Issue',
  'Photo',
  '',
];

export function TaskDashboardTable({
  tasks,
  showActions,
  onReload,
  timeStyle = 'time',
}: TaskDashboardTableProps): ReactElement {
  const {
    editingId,
    draft,
    startEditing,
    cancel,
    update,
    save,
    complete,
    uploadPhoto,
    deletePhoto,
  } = useTaskDashboardTable(onReload);

  return (
    <div className="overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full min-w-[920px] text-left type-meta">
        <thead className="bg-surface-card type-eyebrow uppercase tracking-wide text-notice-secondary">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-2.5 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {tasks.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-notice-secondary">
                No tasks in this section.
              </td>
            </tr>
          )}
          {tasks.map((task) =>
            editingId === task.id && draft ? (
              <EditableTaskRow
                key={task.id}
                task={task}
                draft={draft}
                onChange={update}
                onSave={() => save(task.id)}
                onCancel={cancel}
              />
            ) : (
              <TaskDashboardRow
                key={task.id}
                task={task}
                showActions={showActions}
                timeStyle={timeStyle}
                onEdit={() => startEditing(task)}
                onComplete={() => void complete(task)}
                onUploadPhoto={(files) => void uploadPhoto(task.id, files)}
                onDeletePhoto={(storedName) => void deletePhoto(task.id, storedName)}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
