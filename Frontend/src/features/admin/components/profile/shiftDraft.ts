import type { ShiftNote, ShiftNoteInput } from '../../api/staffShiftApi';

/** The editable form state for one Staff Shift Table row. */
export type Draft = { staffId: string; date: string; start: string; finish: string; issue: string };

export const EMPTY_DRAFT: Draft = { staffId: '', date: '', start: '', finish: '', issue: '' };

export const noteToDraft = (note: ShiftNote): Draft => ({
  staffId: note.staff_id,
  date: note.date,
  start: note.start_time ?? '',
  finish: note.finish_time ?? '',
  issue: note.issue ?? '',
});

export const toShiftNoteInput = (draft: Draft): ShiftNoteInput => ({
  staffId: draft.staffId,
  date: draft.date,
  startTime: draft.start,
  finishTime: draft.finish,
  issue: draft.issue.trim() || null,
});

/** A row is submittable once it names a staff member and a date and has both a
 * start and a finish time. Start/finish are required so task assignment can
 * filter staff by shift hours, not just the shift date. */
export const isDraftComplete = (draft: Draft): boolean =>
  draft.staffId !== '' && draft.date !== '' && draft.start !== '' && draft.finish !== '';
