// (De)serialisation for the Staff Shift Table. It is stored with no schema
// change as a JSON array in the otherwise-unused employees.shift_details TEXT
// column, one array per staff member. Legacy prose values (e.g. "Monday to
// Friday, 07:00 to 15:00") do not start with '[' and so parse as "no entries".

export interface ShiftEntry {
  id: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  finish: string | null; // HH:MM
  issue: string | null;
}

export interface ShiftNoteRow {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  start_time: string | null;
  finish_time: string | null;
  issue: string | null;
}

export const parseEntries = (raw: string | null): ShiftEntry[] => {
  const text = (raw ?? '').trim();
  if (!text.startsWith('[')) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): ShiftEntry[] => {
      if (!value || typeof value !== 'object') return [];
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== 'string' || typeof entry.date !== 'string') return [];
      return [
        {
          id: entry.id,
          date: entry.date,
          start: typeof entry.start === 'string' ? entry.start : null,
          finish: typeof entry.finish === 'string' ? entry.finish : null,
          issue: typeof entry.issue === 'string' ? entry.issue : null,
        },
      ];
    });
  } catch {
    return [];
  }
};

export const serialiseEntries = (entries: ShiftEntry[]): string | null =>
  entries.length > 0 ? JSON.stringify(entries) : null;
