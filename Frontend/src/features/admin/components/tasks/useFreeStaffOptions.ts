import { useEffect } from 'react';
import type { Task, TaskAssignment } from '../../types/task.types';
import { API_ORIGIN } from '../../../../shared/api';

type UseFreeStaffOptionsParams = {
  petId: string;
  task: Task | null;
  time: string;
  staffId: string;
  setStaffId: (value: string) => void;
  onAssignmentsChange: (assignments: TaskAssignment[]) => void;
};

/**
 * Loads the staff free at `time` into the editor's assignment dropdown and
 * clears a now-stale selection. Split out of useTaskEditor unchanged.
 */
export function useFreeStaffOptions({
  petId,
  task,
  time,
  staffId,
  setStaffId,
  onAssignmentsChange,
}: UseFreeStaffOptionsParams): void {
  useEffect(() => {
    if (!time) return;
    const query = `?dueDatetime=${encodeURIComponent(`${time}:00`)}&petId=${encodeURIComponent(petId)}${task ? `&excludeTaskId=${task.id}` : ''}`;
    fetch(`${API_ORIGIN}/api/free-staff${query}`, { credentials: 'include' })
      .then((response): Promise<unknown> => response.json())
      .then((data): void => {
        const free = Array.isArray(data) ? data : [];
        const options: TaskAssignment[] = free.map(
          (item: {
            id: string;
            name: string;
            shift_start: string | null;
            shift_end: string | null;
          }) => ({
            assignment_id: item.id,
            staff_name: item.name,
            shift_start: item.shift_start ?? null,
            shift_end: item.shift_end ?? null,
          }),
        );
        // The dropdown lists staff the manager rostered for this date on the Staff
        // Shift Table AND who have no task within 30 minutes of this time. When an
        // existing task keeps its time, its current assignee stays listed and selected
        // even if no longer free (for example a past task), so other fields can still
        // be edited. Save sends staffId only when it changes.
        const keepsCurrentAssignee =
          task !== null &&
          Boolean(task.staff_id) &&
          time === task.due_datetime?.slice(0, 16) &&
          !options.some((item) => item.assignment_id === task.staff_id);
        const listed = keepsCurrentAssignee
          ? [
              ...options,
              {
                assignment_id: task.staff_id,
                staff_name: task.staff_name,
                shift_start: null,
                shift_end: null,
              },
            ]
          : options;
        onAssignmentsChange(listed);
        // Drop any selection that is no longer a valid option (forces a re-pick).
        if (staffId && !listed.some((item) => item.assignment_id === staffId)) setStaffId('');
      });
    // setStaffId is a stable useState setter; listed only to satisfy exhaustive-deps.
  }, [petId, time, task, staffId, setStaffId, onAssignmentsChange]);
}
