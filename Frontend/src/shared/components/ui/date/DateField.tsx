import React, { useId, useRef, useState } from 'react';
import { useSiteLanguage } from '../../../i18n/siteLanguage';
import { CalendarDialog } from './CalendarDialog';
import { CalendarIcon } from './CalendarIcon';
import { formatDateLabel, parseIsoDate, toIsoDate, type FieldLocale } from './dateValue';
import { FIELD_TEXT } from './fieldText';

export interface DateFieldProps {
  id?: string;
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  /** The field's language; by default the page's (see `useSiteLanguage`). */
  locale?: FieldLocale;
  /** Earliest day that can be picked, "YYYY-MM-DD". */
  min?: string;
  /** Latest day that can be picked, "YYYY-MM-DD". */
  max?: string;
  disabled?: boolean;
  /** Hides Clear, so a chosen date cannot be emptied again. */
  required?: boolean;
  invalid?: boolean;
  /** Renders a hidden input with this name, so a native form still submits the value. */
  name?: string;
  placeholder?: string;
  /** Title of the calendar dialog. Defaults to the placeholder. */
  dialogLabel?: string;
  'aria-describedby'?: string;
  /** Replaces the default field look of the trigger. Layout classes are always kept. */
  className?: string;
  /** Month to open on when there is no value, "YYYY-MM-DD". */
  defaultMonth?: string;
  /** Month and year dropdowns, for dates far from today such as a birth date. */
  yearPicker?: boolean;
}

const TRIGGER_LAYOUT =
  'inline-flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-status-danger';
const TRIGGER_LOOK =
  'w-full min-h-11 rounded-lg border border-field-border bg-surface-card px-4 py-2 text-body text-notice-primary hover:bg-surface-cream focus:outline-hidden focus:ring-2 focus:ring-focus';

/** Today, moved inside the allowed range so the calendar never opens on a month with no choices. */
function clampToRange(day: Date, minDate: Date | null, maxDate: Date | null): Date {
  if (minDate && day < minDate) return minDate;
  if (maxDate && day > maxDate) return maxDate;
  return day;
}

/**
 * A date field drawn by us instead of the browser. A native date input is drawn in the browser's
 * own language whatever the page language is, so an English page in a Chinese Chrome showed
 * the Chinese "year/month/day". This trigger and calendar follow the page language, or the `locale` prop.
 */
export const DateField: React.FC<DateFieldProps> = ({
  id,
  value,
  onChange,
  locale: localeProp,
  min,
  max,
  disabled = false,
  required = false,
  invalid = false,
  name,
  placeholder,
  dialogLabel,
  'aria-describedby': describedBy,
  className,
  defaultMonth,
  yearPicker = false,
}) => {
  const siteLanguage = useSiteLanguage();
  const locale = localeProp ?? siteLanguage;
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const valueId = `${triggerId}-value`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const text = FIELD_TEXT[locale];
  const placeholderText = placeholder ?? text.datePlaceholder;
  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min ?? '');
  const maxDate = parseIsoDate(max ?? '');
  const initialMonth =
    selected ?? parseIsoDate(defaultMonth ?? '') ?? clampToRange(new Date(), minDate, maxDate);
  const label = formatDateLabel(value, locale);

  const handleClosed = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        // An outside <label> becomes the button's name, so the chosen date is read as its description.
        aria-describedby={[valueId, describedBy].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        className={`${TRIGGER_LAYOUT} ${className ?? TRIGGER_LOOK}`}
      >
        <span id={valueId} className={label ? undefined : 'text-notice-muted'}>
          {label || placeholderText}
        </span>
        <CalendarIcon />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={value} />}
      <CalendarDialog
        open={open}
        onClosed={handleClosed}
        onPick={(day) => onChange(toIsoDate(day))}
        onClear={required ? undefined : (): void => onChange('')}
        title={dialogLabel ?? placeholderText}
        locale={locale}
        selected={selected}
        initialMonth={initialMonth}
        minDate={minDate}
        maxDate={maxDate}
        yearPicker={yearPicker}
      />
    </>
  );
};
