import { useEffect, useState, type ReactElement } from 'react';
import { TaskDashboardTable } from '../components/tasks/TaskDashboardTable';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import type { Task } from '../types/task.types';
import { API_ORIGIN } from '../../../shared/api';
import { AdminPage } from '../components/layout/AdminPage';

const RANGES = [
  { value: 'today', label: 'Today', heading: "Today's Tasks" },
  { value: 'week', label: 'This week', heading: "This Week's Tasks" },
  { value: 'month', label: 'This month', heading: "This Month's Tasks" },
] as const;

type TaskRange = (typeof RANGES)[number]['value'];

export function TaskPage(): ReactElement {
  const staffId = useAuthStore((state) => state.user?.id ?? null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [range, setRange] = useState<TaskRange>('today');

  const load = (): void => {
    if (!staffId) return;
    fetch(`${API_ORIGIN}/api/staff/${staffId}/tasks?range=${range}`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []));
  };

  useEffect(load, [staffId, range]);

  if (!staffId) {
    return (
      <p className="p-8 text-center type-body text-notice-secondary">
        Please log in to view your tasks.
      </p>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) =>
    (b.due_datetime ?? '').localeCompare(a.due_datetime ?? ''),
  );

  const todo = sortedTasks.filter(
    (task) => task.status !== 'completed' && task.status !== 'cancelled',
  );
  const completed = sortedTasks.filter((task) => task.status === 'completed');

  return (
    <AdminPage width="wide" className="text-notice-primary">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="type-eyebrow font-bold uppercase text-notice-secondary">Staff workspace</p>
          <h1 className="type-display text-notice-primary">
            {RANGES.find((item) => item.value === range)?.heading}
          </h1>
          <p className="mt-1 type-body text-notice-secondary">
            Review, update, and complete the care assigned to you.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-lg bg-surface-cream p-1 type-meta font-semibold">
            {RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={`rounded-md px-2.5 py-1.5 ${range === item.value ? 'bg-action-dark text-on-action-dark' : 'text-notice-secondary'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 text-center type-meta font-semibold">
            <div className="min-w-20 rounded-lg border border-border-soft bg-surface-card px-3 py-2 text-notice-secondary">
              <span className="block type-card-title text-notice-secondary">{todo.length}</span>To
              do
            </div>
            <div className="min-w-20 rounded-lg border border-border-soft bg-surface-cream px-3 py-2 text-notice-secondary">
              <span className="block type-card-title text-notice-secondary">
                {completed.length}
              </span>
              Completed
            </div>
          </div>
        </div>
      </header>
      <TaskSection
        title="To Do"
        description="Open care tasks that still need your attention."
        count={todo.length}
      >
        <TaskDashboardTable
          tasks={todo}
          showActions
          onReload={load}
          timeStyle={range === 'today' ? 'time' : range === 'week' ? 'weekday' : 'date'}
        />
      </TaskSection>
      <TaskSection
        title="Completed"
        description="Tasks completed during this stay."
        count={completed.length}
      >
        <TaskDashboardTable
          tasks={completed}
          showActions={false}
          onReload={load}
          timeStyle={range === 'today' ? 'time' : range === 'week' ? 'weekday' : 'date'}
        />
      </TaskSection>
    </AdminPage>
  );
}

type TaskSectionProps = {
  title: string;
  description: string;
  count: number;
  children: ReactElement;
};

function TaskSection({ title, description, count, children }: TaskSectionProps): ReactElement {
  return (
    <section className="rounded-xl border border-border-soft bg-surface-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="type-card-title text-notice-primary">{title}</h2>
          <p className="type-meta text-notice-secondary">{description}</p>
        </div>
        <span className="rounded-md bg-surface-cream px-2 py-1 type-meta font-bold text-notice-secondary">
          {count} tasks
        </span>
      </div>
      {children}
    </section>
  );
}
