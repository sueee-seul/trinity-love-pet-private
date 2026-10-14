import { useState, type ReactElement } from 'react';

interface EmployeeNotesCardProps {
  notes: string;
  onSave: (notes: string) => void;
}

export function EmployeeNotesCard({ notes, onSave }: EmployeeNotesCardProps): ReactElement {
  const [draft, setDraft] = useState(notes);
  const [isExpanded, setIsExpanded] = useState(true);
  const isDirty = draft !== notes;

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2"
      >
        <h4 className="type-card-title type-body">Employee Notes</h4>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-notice-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a note for the team…"
            rows={3}
            className="w-full resize-none rounded-lg border border-field-border bg-surface-cream px-3 py-2 type-body text-notice-primary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={!isDirty}
              onClick={() => onSave(draft)}
              className="rounded-full bg-action-dark theme-gradient-action px-4 py-1.5 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
