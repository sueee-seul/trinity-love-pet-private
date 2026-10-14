import React, { useState } from 'react';
import type { GoogleReviewTriageType } from '../../types/googleReview';
import { getGoogleReviewTriageDisplay } from '../../utils/googleReviewPresentation';

const TYPE_OPTIONS: ReadonlyArray<{ value: GoogleReviewTriageType; label: string }> = [
  { value: 'issue', label: 'Issue' },
  { value: 'praise', label: 'Praise' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'general', label: 'General' },
];

const isGoogleReviewTriageType = (value: string): value is GoogleReviewTriageType => {
  return TYPE_OPTIONS.some((option) => option.value === value);
};

interface GoogleReviewTypeEditorProps {
  /** App-owned Google Review id passed back to the parent mutation callback. */
  reviewId: string;
  /** Current API-backed triage value, or null when the review is unclassified. */
  triageType: GoogleReviewTriageType | null;
  /** Manager-only UI gate; hiding the select is not server authorization. */
  canEdit: boolean;
  /** Parent-owned API/store mutation callback; this component only manages interaction state. */
  onChange: (reviewId: string, triageType: GoogleReviewTriageType) => Promise<void>;
}

/**
 * Renders a Google Review triage value as either a read-only tag or a manager edit control.
 *
 * @remarks
 * When `canEdit` is false, the component exposes the current type or an unclassified state and
 * makes no mutation callback. When editing is enabled, it validates the selected union value,
 * disables the select while `onChange` is pending, and renders a local error if that callback
 * rejects. Server authorization remains outside this component.
 */
export const GoogleReviewTypeEditor: React.FC<GoogleReviewTypeEditorProps> = ({
  reviewId,
  triageType,
  canEdit,
  onChange,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <span className="inline-flex items-center rounded border border-border-soft bg-surface-cream px-2 py-0.5 type-meta text-notice-muted">
        {getGoogleReviewTriageDisplay(triageType)}
      </span>
    );
  }

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const nextType = event.target.value;
    if (!isGoogleReviewTriageType(nextType) || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onChange(reviewId, nextType);
    } catch {
      setError('Failed to update review type. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <label htmlFor={`google-review-type-${reviewId}`} className="sr-only">
        Change type for review {reviewId}
      </label>
      <select
        id={`google-review-type-${reviewId}`}
        aria-label={`Review type for ${reviewId}`}
        value={triageType ?? ''}
        onChange={(event) => void handleChange(event)}
        disabled={isSaving}
        className="rounded-md border border-field-border bg-surface-card px-2 py-1 type-meta text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
      >
        <option value="" disabled>
          {triageType ? 'Select type' : getGoogleReviewTriageDisplay(null)}
        </option>
        {TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 type-meta text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
};
