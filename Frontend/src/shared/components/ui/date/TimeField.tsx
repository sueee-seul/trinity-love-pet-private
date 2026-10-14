import React from 'react';
import { useSiteLanguage } from '../../../i18n/siteLanguage';
import { buildTimeOptions, type FieldLocale } from './dateValue';
import { FIELD_TEXT } from './fieldText';

export interface TimeFieldProps {
  id?: string;
  /** "HH:mm", or "" for no time. */
  value: string;
  onChange: (value: string) => void;
  /** The field's language; by default the page's (see `useSiteLanguage`). */
  locale?: FieldLocale;
  stepMinutes?: number;
  /** First time offered, "HH:mm". */
  from?: string;
  /** Last time offered, "HH:mm". Defaults to the last step of the day. */
  to?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  placeholder?: string;
  /** Replaces the default field look of the select. */
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const DEFAULT_STEP_MINUTES = 30;
const SELECT_LOOK =
  'w-full min-h-11 appearance-none rounded-lg border border-field-border bg-surface-card pl-4 pr-10 py-2 text-body text-notice-primary hover:bg-surface-cream focus:outline-hidden focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-status-danger';

/**
 * A time field as a native select with our own labels. A native time input is drawn in the
 * browser's language, while the text of a select's options is ours, so this follows `locale`.
 */
export const TimeField: React.FC<TimeFieldProps> = ({
  id,
  value,
  onChange,
  locale: localeProp,
  stepMinutes = DEFAULT_STEP_MINUTES,
  from = '00:00',
  to,
  disabled = false,
  required = false,
  invalid = false,
  name,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}) => {
  const siteLanguage = useSiteLanguage();
  const locale = localeProp ?? siteLanguage;
  const options = buildTimeOptions({ locale, stepMinutes, from, to, current: value });
  const placeholderText = placeholder ?? FIELD_TEXT[locale].timePlaceholder;

  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={className ?? SELECT_LOOK}
      >
        {/* Disabled when required, so the empty choice shows until a time is picked but cannot be picked back. */}
        <option value="" disabled={required}>
          {placeholderText}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-notice-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
};
