export const priorities = ['low', 'mid', 'high', 'urgent'] as const;
export const statuses = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const taskTypes = ['staff', 'pet'] as const;

export const isUuid = (value: string | string[]): boolean => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    candidate,
  );
};

export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];
export type TaskType = (typeof taskTypes)[number];

export const validId = (value: string | string[]): number | null => {
  const str = Array.isArray(value) ? value[0] : value;
  const id = Number(str);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const validDate = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
