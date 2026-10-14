import React, { useId } from 'react';
import { TimeField } from '../../../../shared/components/ui/date';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeLocale } from '../../types';
import { ERROR_TEXT, FIELD, FIELD_LABEL, HELP_TEXT, TIME_FIELD } from '../conciergeStyles';

/** The fields of the details step, each with its label, hint and error wired for screen readers. */

export const TextField: React.FC<{
  fieldKey: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  autoComplete?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  required?: boolean;
  hint?: string;
  maxLength?: number;
}> = ({
  fieldKey,
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  type = 'text',
  inputMode,
  required = true,
  hint,
  maxLength,
}) => {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        data-field={fieldKey}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={FIELD}
      />
      {hint && (
        <p id={hintId} className={HELP_TEXT}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={`${ERROR_TEXT} mt-1.5`}>
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * A time of day, with the same label and error as TextField. The shared select is used instead of
 * a native time input, which the browser draws in its own language whatever the page language is.
 */
export const TimeChoice: React.FC<{
  label: string;
  locale: ConciergeLocale;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
}> = ({ label, locale, value, onChange, onBlur, error }) => {
  const id = useId();
  const errorId = useId();
  return (
    // The select takes no onBlur of its own; blur bubbles in React, so the wrapper marks it touched.
    <div className="min-w-0" onBlur={onBlur}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <TimeField
        id={id}
        locale={locale}
        value={value}
        required
        invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
        className={TIME_FIELD}
      />
      {error && (
        <p id={errorId} className={`${ERROR_TEXT} mt-1.5`}>
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Offered only for a pet that is not linked to a saved pet yet, so it always starts on "A new
 * pet". Choosing a saved pet links the row, which then shows that pet read-only instead.
 */
export const PetSourcePicker: React.FC<{
  copy: ConciergeCopy;
  savedPets: { id: string; name: string }[];
  onChange: (existingPetId: string | null) => void;
}> = ({ copy, savedPets, onChange }) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={FIELD_LABEL}>
        {copy.details.useSaved}
      </label>
      <select
        id={id}
        value=""
        onChange={(event) => onChange(event.target.value || null)}
        className={FIELD}
      >
        <option value="">{copy.details.newPet}</option>
        {savedPets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export const CareNotes: React.FC<{
  copy: ConciergeCopy;
  value: string;
  fromChat: boolean;
  onChange: (value: string) => void;
}> = ({ copy, value, fromChat, onChange }) => {
  const id = useId();
  const hintId = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={FIELD_LABEL}>
        {copy.details.notes}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={1000}
        value={value}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} resize-y leading-6`}
      />
      <p id={hintId} className={HELP_TEXT}>
        {fromChat ? copy.details.notesFromChat : copy.details.notesHint}
      </p>
    </div>
  );
};
