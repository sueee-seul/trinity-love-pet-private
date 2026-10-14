import { useEffect, useState } from 'react';
import {
  createShiftNote,
  deleteShiftNote,
  fetchShiftNotes,
  fetchShiftStaffOptions,
  updateShiftNote,
  type ShiftNote,
  type ShiftStaffOption,
} from '../../api/staffShiftApi';
import { EMPTY_DRAFT, noteToDraft, toShiftNoteInput, type Draft } from './shiftDraft';

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )}`;

const startOfweek = (d: Date): Date => {
  const offset = (d.getDay() + 6) % 7; //Monday based
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
};

const addDays = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

export type StaffShiftTableApi = {
  notes: ShiftNote[];
  staff: ShiftStaffOption[];
  drafts: Record<string, Draft>;
  newRow: Draft;
  editingId: string | null;
  loading: boolean;
  error: string | null;
  busyId: string | null;
  weekLabel: string;
  stepWeek: (delta: number) => void;
  patch: (id: string, next: Partial<Draft>) => void;
  patchNew: (next: Partial<Draft>) => void;
  startEditing: (note: ShiftNote) => void;
  cancelEditing: (note: ShiftNote) => void;
  addRow: () => Promise<boolean>;
  saveEdit: (noteId: string) => void;
  removeRow: (noteId: string) => void;
};

export function useStaffShiftTable(): StaffShiftTableApi {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfweek(new Date()));
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [staff, setStaff] = useState<ShiftStaffOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newRow, setNewRow] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const range = { from: ymd(weekStart), to: ymd(weekEnd) };
  const weekLabel = `${weekStart.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })} to ${weekEnd.toLocaleDateString(
    'en-NZ',
    { month: 'short', day: 'numeric', year: 'numeric' },
  )}`;

  const apply = (noteRows: ShiftNote[]): void => {
    setNotes(noteRows);
    setDrafts(Object.fromEntries(noteRows.map((note) => [note.id, noteToDraft(note)])));
  };

  // Load staff options and shift notes independently, so the staff dropdown
  // still populates even if the notes query fails.
  const reload = async (): Promise<void> => {
    const [noteResult, staffResult] = await Promise.allSettled([
      fetchShiftNotes(range),
      fetchShiftStaffOptions(),
    ]);
    if (staffResult.status === 'fulfilled') setStaff(staffResult.value);
    if (noteResult.status === 'fulfilled') {
      apply(noteResult.value);
      setError(null);
    } else {
      const cause = noteResult.reason;
      setError(cause instanceof Error ? cause.message : 'Failed to load the shift table');
    }
  };

  useEffect(() => {
    let active = true;
    const weekEnd = addDays(weekStart, 6);
    const range = { from: ymd(weekStart), to: ymd(weekEnd) };
    const run = async (): Promise<void> => {
      const [noteResult, staffResult] = await Promise.allSettled([
        fetchShiftNotes(range),
        fetchShiftStaffOptions(),
      ]);
      if (!active) return;
      if (staffResult.status === 'fulfilled') setStaff(staffResult.value);
      if (noteResult.status === 'fulfilled') {
        apply(noteResult.value);
        setError(null);
      } else {
        const cause = noteResult.reason;
        setError(cause instanceof Error ? cause.message : 'Failed to load the shift table');
      }
      setLoading(false);
    };
    void run();
    return (): void => {
      active = false;
    };
  }, [weekStart]);

  const stepWeek = (delta: number): void => setWeekStart((current) => addDays(current, delta * 7));

  const patch = (id: string, next: Partial<Draft>): void =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));

  const patchNew = (next: Partial<Draft>): void =>
    setNewRow((current) => ({ ...current, ...next }));

  const run = async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Save failed');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const startEditing = (note: ShiftNote): void => {
    setDrafts((current) => ({ ...current, [note.id]: noteToDraft(note) }));
    setEditingId(note.id);
  };

  const cancelEditing = (note: ShiftNote): void => {
    setDrafts((current) => ({ ...current, [note.id]: noteToDraft(note) }));
    setEditingId(null);
  };

  const addRow = (): Promise<boolean> =>
    run('new', async () => {
      await createShiftNote(toShiftNoteInput(newRow));
      setNewRow(EMPTY_DRAFT);
    });

  const saveEdit = (noteId: string): void => {
    void run(noteId, async () => {
      await updateShiftNote(noteId, toShiftNoteInput(drafts[noteId]));
      setEditingId(null);
    });
  };

  const removeRow = (noteId: string): void => {
    void run(noteId, async () => {
      await deleteShiftNote(noteId);
      setEditingId(null);
    });
  };

  return {
    notes,
    staff,
    drafts,
    newRow,
    editingId,
    loading,
    error,
    busyId,
    weekLabel,
    stepWeek,
    patch,
    patchNew,
    startEditing,
    cancelEditing,
    addRow,
    saveEdit,
    removeRow,
  };
}
