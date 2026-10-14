import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useTaskEditor } from '../useTaskEditor';
import type { Task } from '../../../types/task.types';

type SetupResult = {
  result: ReturnType<typeof renderHook<ReturnType<typeof useTaskEditor>, unknown>>['result'];
  onSaved: Mock;
  onDeleted: Mock;
};

// No DB, no server: `fetch` is mocked per test. `useFreeStaffOptions` is
// mocked out entirely so this stays focused on save()/remove()'s own error
// handling (TC-UNIT-08), instead of also exercising the free-staff lookup.
vi.mock('../useFreeStaffOptions', () => ({
  useFreeStaffOptions: vi.fn(),
}));

const EXISTING_TASK: Task = {
  id: 'task-1',
  task_type: 'pet',
  title: 'Feeding (morning)',
  status: 'pending',
  priority: 'mid',
  due_datetime: '2026-09-22T09:00:00.000Z',
  assignment_id: '',
  staff_id: 'staff-1',
  staff_name: 'Sue Staff',
  description: null,
  issue: null,
};

function forbiddenResponse(): Promise<Response> {
  return Promise.resolve({
    ok: false,
    json: () =>
      Promise.resolve({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
      }),
  } as Response);
}

function setup(overrides: Partial<Parameters<typeof useTaskEditor>[0]> = {}): SetupResult {
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  const onAssignmentsChange = vi.fn();
  const { result } = renderHook(() =>
    useTaskEditor({
      petId: 'pet-1',
      task: EXISTING_TASK,
      templates: [],
      onSaved,
      onDeleted,
      onAssignmentsChange,
      ...overrides,
    }),
  );
  return { result, onSaved, onDeleted };
}

describe('useTaskEditor: surfacing save/delete errors (TC-UNIT-08)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('save(): shows the server error message and does not call onSaved when the request is forbidden', async () => {
    vi.stubGlobal('fetch', vi.fn(forbiddenResponse));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result, onSaved } = setup();

    // Pre-filled from the existing task, so canSave is already true.
    expect(result.current.canSave).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledWith('You do not have permission to access this resource');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('remove(): shows the server error message and does not call onDeleted when the request is forbidden', async () => {
    vi.stubGlobal('fetch', vi.fn(forbiddenResponse));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result, onDeleted } = setup();

    await act(async () => {
      await result.current.remove();
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledWith('You do not have permission to access this resource');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('remove(): does nothing if the confirm dialog is dismissed', async () => {
    const fetchMock = vi.fn(forbiddenResponse);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result, onDeleted } = setup();

    await act(async () => {
      await result.current.remove();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
