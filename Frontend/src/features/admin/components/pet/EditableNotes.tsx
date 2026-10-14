import React, { useState } from 'react';

interface EditableNotesProps {
  value: string | null;
  placeholder: string;
  onSave: (notes: string | null) => Promise<void>;
}

export const EditableNotes: React.FC<EditableNotesProps> = ({ value, placeholder, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = (): void => {
    setDraft(value ?? '');
    setError(null);
    setIsEditing(true);
  };

  const cancelEditing = (): void => {
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft.trim() || null);
      setIsEditing(false);
    } catch (saveError) {
      console.error('Failed to save notes', saveError);
      setError('Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div>
        <textarea
          aria-label="Notes"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="w-full rounded border border-field-border bg-surface-card px-2 py-1.5 type-meta text-notice-primary outline-none focus:border-control-border"
        />
        {error && (
          <p role="alert" className="mt-1 type-meta font-semibold text-status-danger">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="type-meta font-semibold text-notice-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-action-dark px-2 py-1 type-meta font-semibold text-on-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <p className="type-meta text-notice-primary">{value || placeholder}</p>
      <button
        type="button"
        onClick={startEditing}
        className="shrink-0 rounded bg-surface-cream px-2 py-1 type-meta font-semibold text-notice-secondary hover:bg-surface-deep"
      >
        Edit
      </button>
    </div>
  );
};
