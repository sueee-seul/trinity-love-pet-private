import { useState } from 'react';
import type { Task, TaskDraft } from '../../types/task.types';
import { API_ORIGIN } from '../../../../shared/api';

const toDraft = (task: Task): TaskDraft => ({
  taskType: task.task_type,
  title: task.title,
  status: task.status,
  priority: task.priority,
  time: task.due_datetime?.slice(0, 16) ?? '',
  description: task.description ?? '',
  issue: task.issue ?? '',
});

type UseTaskDashboardTableResult = {
  editingId: string | null;
  draft: TaskDraft | null;
  startEditing: (task: Task) => void;
  cancel: () => void;
  update: (values: Partial<TaskDraft>) => void;
  save: (id: string) => Promise<void>;
  complete: (task: Task) => Promise<void>;
  uploadPhoto: (id: string, files: File[]) => Promise<void>;
  deletePhoto: (id: string, storedName: string) => Promise<void>;
};

export function useTaskDashboardTable(onReload: () => void): UseTaskDashboardTableResult {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  const startEditing = (task: Task): void => {
    setEditingId(task.id);
    setDraft(toDraft(task));
  };
  const cancel = (): void => {
    setEditingId(null);
    setDraft(null);
  };
  const update = (values: Partial<TaskDraft>): void =>
    setDraft((current) => (current ? { ...current, ...values } : current));
  const save = async (id: string): Promise<void> => {
    if (!draft) return;
    const response = await fetch(`${API_ORIGIN}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        taskType: draft.taskType,
        title: draft.title.trim(),
        status: draft.status,
        priority: draft.priority,
        dueDatetime: draft.time ? `${draft.time}:00` : undefined,
        description: draft.description,
        issue: draft.issue,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error || 'Unable to save task.');
      return;
    }
    cancel();
    onReload();
  };
  const complete = async (task: Task): Promise<void> => {
    if (task.overdue && !(task.issue ?? '').trim()) {
      const entered = window.prompt('This task is overdue. Please enter the reason for the delay:');
      if (entered === null || !entered.trim()) return;
      const saved = await fetch(`${API_ORIGIN}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ issue: entered.trim() }),
      });
      if (!saved.ok) {
        const error = await saved.json().catch(() => null);
        window.alert(error?.error || 'Unable to save task.');
        return;
      }
    }
    const response = await fetch(`${API_ORIGIN}/api/tasks/${task.id}/complete`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error || 'Unable to complete task.');
      return;
    }
    onReload();
  };

  const uploadPhoto = async (id: string, files: File[]): Promise<void> => {
    if (files.length === 0) return;
    const body = new FormData();
    files.forEach((file) => body.append('photos', file));
    const response = await fetch(`${API_ORIGIN}/api/tasks/${id}/photos`, {
      method: 'POST',
      credentials: 'include',
      body,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error || 'Unable to upload photo.');
      return;
    }
    onReload();
  };
  const deletePhoto = async (id: string, storedName: string): Promise<void> => {
    if (!window.confirm('Delete this photo?')) return;
    const response = await fetch(`${API_ORIGIN}/api/tasks/${id}/photos/${storedName}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => null);
      window.alert(error?.error || 'Unable to delete photo.');
      return;
    }
    onReload();
  };

  return {
    editingId,
    draft,
    startEditing,
    cancel,
    update,
    save,
    complete,
    uploadPhoto,
    deletePhoto,
  };
}
