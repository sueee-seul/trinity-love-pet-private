import { API_ORIGIN } from '../../../shared/api';

export type TaskType = 'staff' | 'pet';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'mid' | 'high' | 'urgent';

export type Task = {
  id: string;
  task_type: TaskType;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_datetime: string | null;
  /** Derived server-side: past due and not completed/cancelled. */
  overdue?: boolean;
  assignment_id: string;
  staff_id: string;
  staff_name: string;
  description: string | null;
  issue: string | null;
  pet_id?: string;
  pet_name?: string;
  owner_name?: string;
  /** Every photo attached to the task, oldest first. */
  photos?: TaskPhoto[];
};

export type TaskPhoto = {
  /** Random on-disk filename; identifies the photo in URLs. */
  stored_name: string;
  /** Original filename, shown in the UI. */
  name: string;
  /** Upload timestamp tag (YYYYMMDDHHMMSS), used to cache-bust the download. */
  at: string;
};

/** How many photos a single task is allowed to carry (matches the backend). */
export const MAX_TASK_PHOTOS = 3;

/** Download URL of one task photo, cache-busted by upload time. */
export const taskPhotoUrl = (taskId: string, photo: TaskPhoto): string =>
  `${API_ORIGIN}/api/tasks/${taskId}/photos/${photo.stored_name}?v=${photo.at}`;

export type TaskTemplate = {
  id: string;
  title: string;
  category: string;
};

export type TaskAssignment = {
  assignment_id: string;
  staff_name: string;
  shift_start: string | null;
  shift_end: string | null;
};

export type TaskDraft = {
  taskType: TaskType;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  time: string;
  description: string;
  issue: string;
};

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'mid', 'high', 'urgent'];
export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TaskTimeStyle = 'time' | 'weekday' | 'date';

/**
 * `scheduled_at` is entered and stored as a wall-clock time. Render the hours
 * and minutes exactly as stored instead of `new Date(...).toLocaleString()`,
 * which re-interprets the value in the viewer's timezone and flips AM/PM for
 * anyone offset from the server. `style` adds a day prefix for lists that span
 * more than one day: 'weekday' -> "Tue 9:00 AM" (single week),
 * 'date' -> "Aug 25, 9:00 AM" (whole month, where a weekday alone is ambiguous).
 */
export const formatTaskTime = (value: string | null, style: TaskTimeStyle = 'time'): string => {
  const match = value?.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return 'No time';
  const [, year, month, day, hh, mm] = match;
  const hour = Number(hh);
  // A task made from a booking is stored at midnight until the manager sets its real time.
  const hasTime = hh !== '00' || mm !== '00';
  const time = hasTime ? `${hour % 12 || 12}:${mm} ${hour >= 12 ? 'PM' : 'AM'}` : 'time not set';
  if (style === 'time') return hasTime ? time : 'Time not set';
  if (style === 'date') return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${time}`;
  const weekday =
    WEEKDAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
  return hasTime ? `${weekday} ${time}` : `${weekday}, ${time}`;
};

/**
 * Snap a `datetime-local` input value to the nearest 10 minutes. The native
 * `step` only constrains the keyboard spinner; the calendar/clock popup still
 * lets you land on any minute, so normalise on change.
 */
export const snapTimeInputTo10 = (value: string): string => {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(Math.round(date.getMinutes() / 10) * 10, 0, 0);
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
