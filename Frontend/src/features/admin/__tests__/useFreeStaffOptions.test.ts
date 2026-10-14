import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFreeStaffOptions } from '../components/tasks/useFreeStaffOptions';
import type { Task } from '../types/task.types';

const PAST_TASK: Task = {
  id: 'task-1',
  task_type: 'pet',
  title: 'Dinner',
  status: 'pending',
  priority: 'mid',
  due_datetime: '2026-09-27T17:30:00.000Z',
  assignment_id: '',
  staff_id: 'staff-liam',
  staff_name: 'liam.thompson',
  description: null,
  issue: null,
};

const stubFreeStaff = (free: unknown[]): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ json: () => Promise.resolve(free) } as Response)),
  );
};

const renderOptions = (
  time: string,
): { setStaffId: ReturnType<typeof vi.fn>; onAssignmentsChange: ReturnType<typeof vi.fn> } => {
  const setStaffId = vi.fn();
  const onAssignmentsChange = vi.fn();
  renderHook(() =>
    useFreeStaffOptions({
      petId: 'pet-1',
      task: PAST_TASK,
      time,
      staffId: PAST_TASK.staff_id,
      setStaffId,
      onAssignmentsChange,
    }),
  );
  return { setStaffId, onAssignmentsChange };
};

describe('useFreeStaffOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the current assignee of a past task when its time is unchanged', async () => {
    stubFreeStaff([]); // nobody is rostered on that past date

    const { setStaffId, onAssignmentsChange } = renderOptions('2026-09-27T17:30');

    await waitFor(() =>
      expect(onAssignmentsChange).toHaveBeenCalledWith([
        {
          assignment_id: 'staff-liam',
          staff_name: 'liam.thompson',
          shift_start: null,
          shift_end: null,
        },
      ]),
    );
    expect(setStaffId).not.toHaveBeenCalled();
  });

  it('asks for a new assignee when the time changes and they are not free', async () => {
    stubFreeStaff([]);

    const { setStaffId, onAssignmentsChange } = renderOptions('2026-09-27T18:30');

    await waitFor(() => expect(onAssignmentsChange).toHaveBeenCalledWith([]));
    expect(setStaffId).toHaveBeenCalledWith('');
  });
});
