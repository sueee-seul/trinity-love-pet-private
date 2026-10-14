import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Task, TaskTemplate, TaskAssignment } from '../types/task.types';
import type { ManagerBookingRecord } from '../types/booking';
import { useBookingStore } from '../store/bookingStore';
import { TaskEditor } from './tasks/TaskEditor';
import { TaskTable } from './tasks/TaskTable';
import { fallbackTemplates, RANGES, type TimelineRange } from './taskTimeline.constants';
import { API_ORIGIN } from '../../../shared/api';

type TaskGroup = {
  key: string;
  heading: string;
  checkIn: string | null;
  isHighlighted: boolean;
  tasks: Task[];
};

// Buckets tasks by whichever of this pet's bookings covers a task's date.
// Tasks carry no booking id, so this matches on the booking's own check-in /
// check-out window instead (same idea as the backend's findTasksForBookingPet).
const groupTasksByBooking = (
  tasks: Task[],
  petBookings: ManagerBookingRecord[],
  highlightUuid: string | null,
): TaskGroup[] => {
  const remaining = new Set(tasks.map((task) => task.id));
  const groups: TaskGroup[] = [];

  for (const booking of petBookings) {
    const { check_in, check_out } = booking.booking.dates;
    if (!check_in || !check_out) continue;
    const matched = tasks.filter((task) => {
      const date = task.due_datetime?.slice(0, 10);
      return date !== undefined && date >= check_in && date <= check_out;
    });
    matched.forEach((task) => remaining.delete(task.id));
    groups.push({
      key: booking.booking_pets_uuid,
      heading: `${check_in} to ${check_out}`,
      checkIn: check_in,
      isHighlighted: booking.booking_pets_uuid === highlightUuid,
      tasks: matched,
    });
  }

  const leftover = tasks.filter((task) => remaining.has(task.id));
  if (leftover.length > 0) {
    groups.push({
      key: 'unscheduled',
      heading: 'Other tasks',
      checkIn: null,
      isHighlighted: false,
      tasks: leftover,
    });
  }
  return groups;
};

export function TaskTimeline({
  petId,
  onAssignedStaffChange,
}: {
  petId: string;
  /** Reports the distinct staff assigned across the loaded timeline tasks. */
  onAssignedStaffChange?: (staffNames: string[]) => void;
}): ReactElement {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>(fallbackTemplates);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [range, setRange] = useState<TimelineRange>('all');
  const [statusFilter, setStatusFilter] = useState<Task['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  // Prefills a new task's date to the section it was added from (e.g. "+ Add
  // task" under the 21-24 booking group defaults the date to the 21st) so it
  // lands back in the same group once saved. Unused when editing an existing task.
  const [newTaskDefaultDate, setNewTaskDefaultDate] = useState<string | undefined>(undefined);
  const [searchParams] = useSearchParams();
  // Carried over from the booking card's "View Profile" link. It is used only to
  // highlight/scroll to that booking's group below, not to change what's fetched.
  const highlightBookingUuid = searchParams.get('bookingPetsUuid');

  const bookingByUuid = useBookingStore((state) => state.bookingByUuid);
  const bookingUuids = useBookingStore((state) => state.bookingUuids);
  const loadBookings = useBookingStore((state) => state.loadBookings);

  useEffect(() => {
    if (bookingUuids.length === 0) void loadBookings();
    // Runs once on mount to seed the store if some other page hasn't already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const petBookings = useMemo(
    () =>
      bookingUuids
        .map((uuid) => bookingByUuid[uuid])
        .filter(
          (booking): booking is ManagerBookingRecord =>
            Boolean(booking) &&
            booking.pet.id === petId &&
            booking.booking.manager_review_status === 'approved',
        )
        .sort((a, b) =>
          (b.booking.dates.check_in ?? '').localeCompare(a.booking.dates.check_in ?? ''),
        ),
    [bookingUuids, bookingByUuid, petId],
  );

  const loadTasks = useCallback((): void => {
    fetch(`${API_ORIGIN}/api/pets/${petId}/tasks?range=${range}`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []));
  }, [petId, range]);

  useEffect(loadTasks, [loadTasks]);

  const uploadPhoto = (taskId: string, files: File[]): void => {
    if (files.length === 0) return;
    const body = new FormData();
    files.forEach((file) => body.append('photos', file));
    fetch(`${API_ORIGIN}/api/tasks/${taskId}/photos`, {
      method: 'POST',
      credentials: 'include',
      body,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          window.alert(error?.error || 'Unable to upload photo.');
          return;
        }
        loadTasks();
      })
      .catch(() => window.alert('Unable to upload photo.'));
  };

  const deletePhoto = (taskId: string, storedName: string): void => {
    fetch(`${API_ORIGIN}/api/tasks/${taskId}/photos/${storedName}`, {
      method: 'DELETE',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          window.alert(error?.error?.message ?? error?.error ?? 'Unable to delete photo.');
          return;
        }
        loadTasks();
      })
      .catch(() => window.alert('Unable to delete photo.'));
  };

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/task-templates`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTemplates(data);
      });
  }, []);

  useEffect(() => {
    onAssignedStaffChange?.([
      ...new Set(
        tasks.map((task) => task.staff_name).filter((name): name is string => Boolean(name)),
      ),
    ]);
  }, [tasks, onAssignedStaffChange]);

  useEffect(() => {
    if (!highlightBookingUuid) return;
    document
      .getElementById(`booking-group-${highlightBookingUuid}`)
      ?.scrollIntoView({ block: 'start' });
  }, [highlightBookingUuid, tasks]);

  const activeRange = RANGES.find((item) => item.value === range) ?? RANGES[0];

  const visibleTasks = tasks.filter(
    (task) =>
      (statusFilter === 'all' || task.status === statusFilter) &&
      (priorityFilter === 'all' || task.priority === priorityFilter),
  );

  const groups = useMemo(
    () => groupTasksByBooking(visibleTasks, petBookings, highlightBookingUuid),
    [visibleTasks, petBookings, highlightBookingUuid],
  );

  const openEditor = (
    task: Task | undefined,
    defaultDate: string | undefined,
    groupKey: string,
  ): void => {
    setEditorTask(task ?? null);
    setIsCreating(!task);
    setNewTaskDefaultDate(task ? undefined : defaultDate);
    setActiveGroupKey(groupKey);
  };

  const closeEditor = (): void => {
    setEditorTask(null);
    setIsCreating(false);
    setActiveGroupKey(null);
  };

  // Booking sections page 3 at a time instead of stacking forever.
  const PAGE_SIZE = 3;
  const [groupPage, setGroupPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(groupPage, pageCount - 1);
  const visibleGroups = groups.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="rounded-xl border border-border-soft bg-surface-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <h2 className="mr-2 type-card-title text-notice-primary">{activeRange.heading}</h2>
        {RANGES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setRange(item.value)}
            className={`rounded-md px-2 py-1 type-meta font-semibold ${range === item.value ? 'bg-action-dark text-on-action-dark' : 'bg-surface-cream text-notice-secondary'}`}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-2 mr-1 type-meta font-bold text-notice-secondary">Status</span>
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-md px-2 py-1 type-meta font-semibold ${statusFilter === filter ? 'bg-action-dark text-on-action-dark' : 'bg-surface-cream text-notice-secondary'}`}
          >
            {filter === 'all' ? 'All' : filter}
          </button>
        ))}
        <span className="ml-2 mr-1 type-meta font-bold text-notice-secondary">Priority</span>
        {(['all', 'urgent', 'high', 'mid', 'low'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setPriorityFilter(filter)}
            className={`rounded-md px-2 py-1 type-meta font-semibold ${priorityFilter === filter ? 'bg-action-dark text-on-action-dark' : 'bg-surface-cream text-notice-secondary'}`}
          >
            {filter === 'all' ? 'All' : filter}
          </button>
        ))}
      </div>

      {visibleGroups.map((group) => (
        <div
          key={group.key}
          id={`booking-group-${group.key}`}
          className={`mb-4 rounded-lg ${group.isHighlighted ? 'ring-2 ring-control-border' : ''}`}
        >
          <h3 className="mb-1.5 px-1 type-card-title text-notice-secondary">{group.heading}</h3>
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <TaskTable
              tasks={group.tasks}
              onEdit={(task) => openEditor(task, group.checkIn ?? undefined, group.key)}
              onAdd={() => openEditor(undefined, group.checkIn ?? undefined, group.key)}
              onUploadPhoto={uploadPhoto}
              onDeletePhoto={deletePhoto}
              timeStyle={activeRange.timeStyle}
            />
          </div>
          {activeGroupKey === group.key && (isCreating || editorTask) && (
            <TaskEditor
              key={editorTask?.id ?? 'new'}
              petId={petId}
              task={editorTask}
              defaultDate={newTaskDefaultDate}
              templates={templates}
              onClose={closeEditor}
              onSaved={(savedTask) => {
                setTasks((current) =>
                  editorTask
                    ? current.map((task) => (task.id === savedTask.id ? savedTask : task))
                    : [...current, savedTask],
                );
                closeEditor();
              }}
              onDeleted={(taskId) => {
                setTasks((current) => current.filter((task) => task.id !== taskId));
                closeEditor();
              }}
              onAssignmentsChange={setAssignments}
              assignments={assignments}
            />
          )}
        </div>
      ))}
      {groups.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setGroupPage(currentPage - 1)}
            className="rounded-md px-2 py-1 type-meta font-semibold text-notice-secondary disabled:opacity-30"
          >
            ‹ Prev
          </button>
          <span className="type-meta text-notice-secondary">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setGroupPage(currentPage + 1)}
            className="rounded-md px-2 py-1 type-meta font-semibold text-notice-secondary disabled:opacity-30"
          >
            Next ›
          </button>
        </div>
      )}
    </section>
  );
}
