import { useState } from 'react';
import type { Task, TaskAssignment, TaskTemplate } from '../../types/task.types';
import { useFreeStaffOptions } from './useFreeStaffOptions';
import { API_ORIGIN } from '../../../../shared/api';

type UseTaskEditorProps = {
  petId: string;
  task: Task | null;
  defaultDate?: string;
  templates: TaskTemplate[];
  onSaved: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onAssignmentsChange: (assignments: TaskAssignment[]) => void;
};

type UseTaskEditorResult = {
  templateId: string;
  taskType: Task['task_type'];
  customTitle: string;
  status: Task['status'];
  priority: Task['priority'];
  time: string;
  staffId: string;
  issue: string;
  description: string;
  templates: TaskTemplate[];
  title: string;
  canSave: boolean;
  setTemplateId: (value: string) => void;
  setTaskType: (value: Task['task_type']) => void;
  setCustomTitle: (value: string) => void;
  setStatus: (value: Task['status']) => void;
  setPriority: (value: Task['priority']) => void;
  setTime: (value: string) => void;
  setStaffId: (value: string) => void;
  setIssue: (value: string) => void;
  setDescription: (value: string) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
};

export function useTaskEditor({
  petId,
  task,
  defaultDate,
  templates,
  onSaved,
  onDeleted,
  onAssignmentsChange,
}: UseTaskEditorProps): UseTaskEditorResult {
  const [templateId, setTemplateId] = useState('');
  const [taskType, setTaskType] = useState<Task['task_type']>(task?.task_type ?? 'staff');
  const [customTitle, setCustomTitle] = useState(task?.title ?? '');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'pending');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'mid');
  const [time, setTime] = useState(
    task?.due_datetime?.slice(0, 16) ?? (defaultDate ? `${defaultDate}T09:00` : ''),
  );
  const [staffId, setStaffId] = useState(task?.staff_id ?? '');
  const [issue, setIssue] = useState(task?.issue ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const selectedTemplate = templates.find((item) => item.id === templateId);
  const title = selectedTemplate?.title ?? customTitle.trim();
  const canSave = Boolean(title && time && staffId);

  useFreeStaffOptions({ petId, task, time, staffId, setStaffId, onAssignmentsChange });

  const save = async (): Promise<void> => {
    if (!canSave) return;
    const payload = {
      // On edit, only send staffId when it actually changed so unrelated field
      // edits aren't blocked by the on-shift check for a legacy assignee.
      staffId: !task || staffId !== task.staff_id ? staffId : undefined,
      taskType,
      templateId: templateId && templateId !== 'other' ? templateId : undefined,
      title,
      priority,
      status,
      dueDatetime: `${time}:00`,
      description: description || undefined,
      issue: issue || undefined,
    };
    const response = await fetch(
      task
        ? `${API_ORIGIN}/api/pets/${petId}/tasks/${task.id}`
        : `${API_ORIGIN}/api/pets/${petId}/tasks`,
      {
        method: task ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error?.message ?? error?.error ?? 'Unable to save task.');
      return;
    }
    onSaved(await response.json());
  };

  const remove = async (): Promise<void> => {
    if (!task || !window.confirm('Delete this task?')) return;
    const response = await fetch(`${API_ORIGIN}/api/tasks/${task.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error?.message ?? error?.error ?? 'Unable to delete task.');
      return;
    }
    onDeleted(task.id);
  };

  return {
    templateId,
    taskType,
    customTitle,
    status,
    priority,
    time,
    staffId,
    issue,
    description,
    templates,
    title,
    canSave,
    setTemplateId,
    setTaskType,
    setCustomTitle,
    setStatus,
    setPriority,
    setTime,
    setStaffId,
    setIssue,
    setDescription,
    save,
    remove,
  };
}
