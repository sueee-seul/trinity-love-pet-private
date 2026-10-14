import { useMemo, useState, type ReactElement } from 'react';
import type { ShiftNote } from '../../api/staffShiftApi';
import { ShiftRowFields } from './ShiftRowFields';
import { ShiftFormFields } from './ShiftFormFields';
import { EMPTY_DRAFT, isDraftComplete } from './shiftDraft';
import { useStaffShiftTable } from './useStaffShiftTable';
import { Modal } from '../../../../shared/components/ui/Modal';

const primaryButton =
  'rounded bg-action-dark theme-gradient-action px-2.5 py-1 type-meta font-semibold text-on-action-dark disabled:opacity-50';
const ghostButton =
  'rounded bg-surface-deep px-2.5 py-1 type-meta font-semibold text-notice-secondary disabled:opacity-50';
const dangerButton =
  'rounded bg-status-danger/10 px-2.5 py-1 type-meta font-semibold text-status-danger disabled:opacity-50';

export function StaffShiftTable(): ReactElement {
  const table = useStaffShiftTable();
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const visibleNotes = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return table.notes;
    return table.notes.filter((note) => note.staff_name.toLowerCase().includes(trimmed));
  }, [table.notes, query]);

  const closeAdd = (): void => {
    table.patchNew(EMPTY_DRAFT);
    setIsAddOpen(false);
  };

  const submitAdd = async (): Promise<void> => {
    const ok = await table.addRow();
    if (ok) setIsAddOpen(false);
  };

  const savedRow = (note: ShiftNote): ReactElement => (
    <tr key={note.id} className="align-top">
      <td className="py-2.5 pr-3 font-medium text-notice-primary">{note.staff_name}</td>
      <td className="py-2.5 pr-3">{note.date}</td>
      <td className="py-2.5 pr-3">{note.start_time ?? 'Not set'}</td>
      <td className="py-2.5 pr-3">
        {note.finish_time ?? 'Not set'}
        {note.start_time && note.finish_time && note.finish_time <= note.start_time ? ' (+1d)' : ''}
      </td>
      <td className="py-2.5 pr-3">{note.issue?.trim() ? note.issue : 'None'}</td>
      <td className="whitespace-nowrap py-2.5 text-right">
        <button
          type="button"
          disabled={table.editingId !== null || table.busyId !== null}
          onClick={() => table.startEditing(note)}
          className={ghostButton}
        >
          Edit
        </button>
      </td>
    </tr>
  );

  const editingRow = (note: ShiftNote): ReactElement => {
    const draft = table.drafts[note.id];
    const busy = table.busyId === note.id;
    return (
      <tr key={note.id} className="align-top bg-surface-deep/40">
        <ShiftRowFields
          draft={draft}
          staff={table.staff}
          onPatch={(next) => table.patch(note.id, next)}
        />
        <td className="whitespace-nowrap py-2 text-right">
          <button
            type="button"
            disabled={busy || !isDraftComplete(draft)}
            onClick={() => table.saveEdit(note.id)}
            className={primaryButton}
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => table.cancelEditing(note)}
            className={`ml-2 ${ghostButton}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => table.removeRow(note.id)}
            className={`ml-2 ${dangerButton}`}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card animate-in fade-in duration-300">
      <header className="mb-1">
        <h2 className="type-display">Staff Shift Table</h2>
        <p className="type-body text-notice-muted">
          Record each staff member&apos;s shift by date. Start and finish times are required. A
          finish at or before the start is read as an overnight shift ending the next day.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.stepWeek(-1)}
            aria-label="Previous week"
            className={ghostButton}
          >
            ‹
          </button>
          <span className="type-body font-medium">{table.weekLabel}</span>
          <button
            type="button"
            onClick={() => table.stepWeek(1)}
            aria-label="Next week"
            className={ghostButton}
          >
            ›
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by staff name"
          className="w-full max-w-64 rounded border border-field-border bg-surface-card px-3 py-1.5 type-body outline-none focus:border-focus"
        />

        <button type="button" onClick={() => setIsAddOpen(true)} className={primaryButton}>
          + Add shift
        </button>
      </div>

      {table.error && (
        <p role="alert" className="mt-3 type-body text-status-danger">
          {table.error}
        </p>
      )}
      {table.loading ? (
        <p className="mt-4 type-body text-notice-muted">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left type-body">
            <thead className="type-meta uppercase tracking-wide text-notice-muted">
              <tr>
                <th className="py-2 pr-3">Staff</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Start *</th>
                <th className="py-2 pr-3">Finish *</th>
                <th className="py-2 pr-3">Issue</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {visibleNotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-notice-muted">
                    {query.trim()
                      ? 'No shifts match your search.'
                      : 'No shifts recorded this week.'}
                  </td>
                </tr>
              )}
              {visibleNotes.map((note) =>
                table.editingId === note.id ? editingRow(note) : savedRow(note),
              )}
            </tbody>
          </table>
          <Modal isOpen={isAddOpen} onClose={closeAdd}>
            <div className="p-6">
              <h3 className="type-display mb-4">Add shift</h3>
              <ShiftFormFields draft={table.newRow} staff={table.staff} onPatch={table.patchNew} />
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={closeAdd} className={ghostButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={table.busyId === 'new' || !isDraftComplete(table.newRow)}
                  onClick={submitAdd}
                  className={primaryButton}
                >
                  Add
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
