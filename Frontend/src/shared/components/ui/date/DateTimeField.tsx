import React, { useId, useState } from 'react';
import { useSiteLanguage } from '../../../i18n/siteLanguage';
import { DateField } from './DateField';
import { TimeField } from './TimeField';
import {
  joinDateTime,
  splitDateTime,
  toDatePart,
  type DateTimeParts,
  type FieldLocale,
} from './dateValue';
import { FIELD_TEXT } from './fieldText';

export interface DateTimeFieldProps {
  id?: string;
  /** "YYYY-MM-DDTHH:mm", or "" for no value. */
  value: string;
  onChange: (value: string) => void;
  /** The field's language; by default the page's (see `useSiteLanguage`). */
  locale?: FieldLocale;
  /** Earliest day, as "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm". Only the day part limits the calendar. */
  min?: string;
  /** Latest day, as "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm". Only the day part limits the calendar. */
  max?: string;
  stepMinutes?: number;
  disabled?: boolean;
  required?: boolean;
  /** Renders a hidden input with the combined value, like a datetime-local input would submit. */
  name?: string;
  /** Classes for the wrapper around the two parts. */
  className?: string;
  /**
   * Classes for both controls, replacing their default look. Dense tables pass their own compact
   * field classes here, because the wrapper classes cannot reach the two parts.
   */
  fieldClassName?: string;
}

/**
 * A date and a time side by side that read and write one "YYYY-MM-DDTHH:mm" value.
 *
 * The half-filled state lives here: the value stays "" until both parts are chosen, so a date
 * picked before its time is kept locally instead of being lost when the parent echoes "" back.
 */
export const DateTimeField: React.FC<DateTimeFieldProps> = ({
  id,
  value,
  onChange,
  locale: localeProp,
  min,
  max,
  stepMinutes,
  disabled = false,
  required = false,
  name,
  className = '',
  fieldClassName,
}) => {
  const siteLanguage = useSiteLanguage();
  const locale = localeProp ?? siteLanguage;
  const generatedId = useId();
  const dateId = id ?? generatedId;
  const [parts, setParts] = useState<DateTimeParts>(() => splitDateTime(value));
  const [seenValue, setSeenValue] = useState(value);

  // A new value from the parent replaces the parts, unless it is just the echo of our own parts.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== joinDateTime(parts)) setParts(splitDateTime(value));
  }

  const updatePart = (change: Partial<DateTimeParts>): void => {
    const next = { ...parts, ...change };
    setParts(next);
    const combined = joinDateTime(next);
    if (combined !== value) onChange(combined);
  };

  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <div className="sm:flex-1">
        <DateField
          id={dateId}
          value={parts.date}
          onChange={(date) => updatePart({ date })}
          locale={locale}
          min={toDatePart(min)}
          max={toDatePart(max)}
          disabled={disabled}
          required={required}
          className={fieldClassName}
        />
      </div>
      <div className="sm:w-40">
        <TimeField
          id={`${dateId}-time`}
          value={parts.time}
          onChange={(time) => updatePart({ time })}
          locale={locale}
          stepMinutes={stepMinutes}
          disabled={disabled}
          required={required}
          aria-label={FIELD_TEXT[locale].timeLabel}
          className={fieldClassName}
        />
      </div>
      {name !== undefined && <input type="hidden" name={name} value={value} />}
    </div>
  );
};
