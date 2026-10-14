import type { TaskTemplate } from '../types/task.types';

const fallbackTemplates: TaskTemplate[] = [
  { id: '00000000-0000-4000-8000-000000000d01', title: 'Potty break', category: 'routine' },
  { id: '00000000-0000-4000-8000-000000000d02', title: 'Breakfast', category: 'meal' },
  { id: '00000000-0000-4000-8000-000000000d03', title: 'Lunch', category: 'meal' },
  { id: '00000000-0000-4000-8000-000000000d04', title: 'Dinner', category: 'meal' },
  { id: '00000000-0000-4000-8000-000000000d05', title: 'Kennel cleaning', category: 'hygiene' },
  {
    id: '00000000-0000-4000-8000-000000000d06',
    title: 'Play / socialisation',
    category: 'activity',
  },
  { id: '00000000-0000-4000-8000-000000000d07', title: 'Rest time', category: 'routine' },
  { id: '00000000-0000-4000-8000-000000000d08', title: 'Dog yard playtime', category: 'activity' },
];

const RANGES = [
  { value: 'all', label: 'All', heading: 'Task Timeline', timeStyle: 'date' },
  { value: 'today', label: 'Today', heading: "Today's Task Timeline", timeStyle: 'time' },
  { value: 'week', label: 'This week', heading: "This Week's Task Timeline", timeStyle: 'weekday' },
  { value: 'month', label: 'This month', heading: "This Month's Task Timeline", timeStyle: 'date' },
] as const;

type TimelineRange = (typeof RANGES)[number]['value'];

export { fallbackTemplates, RANGES };
export type { TimelineRange };
