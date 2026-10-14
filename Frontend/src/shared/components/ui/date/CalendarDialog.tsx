import React, { useId, useLayoutEffect, useRef } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { getCalendarClassNames } from './calendarClassNames';
import { DATE_FNS_LOCALES, type FieldLocale } from './dateValue';
import { FIELD_TEXT } from './fieldText';

export interface CalendarDialogProps {
  open: boolean;
  /** Called once the dialog has actually closed, whatever closed it. */
  onClosed: () => void;
  onPick: (day: Date) => void;
  /** Omit it to hide the Clear button, as a required field does. */
  onClear?: () => void;
  title: string;
  locale: FieldLocale;
  selected: Date | null;
  initialMonth: Date;
  minDate: Date | null;
  maxDate: Date | null;
  yearPicker: boolean;
}

// Monday first, the way New Zealand and Chinese calendars are printed.
const WEEK_STARTS_ON_MONDAY = 1;
const DIALOG_SHADOW = '0 12px 40px color-mix(in srgb, var(--color-shadow-tint) 14%, transparent)';
const CLASS_NAMES = getCalendarClassNames();
const FOOTER_BUTTON =
  'inline-flex h-11 items-center rounded-full px-4 text-btn font-bold text-notice-secondary hover:bg-surface-deep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus';

function buildDisabledDays(minDate: Date | null, maxDate: Date | null): Matcher[] {
  const matchers: Matcher[] = [];
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });
  return matchers;
}

/**
 * The calendar in a native modal dialog. A native dialog sits in the browser's top layer, so no
 * stacking context on the page can hide it, and the browser traps focus and handles Escape.
 */
export const CalendarDialog: React.FC<CalendarDialogProps> = ({
  open,
  onClosed,
  onPick,
  onClear,
  title,
  locale,
  selected,
  initialMonth,
  minDate,
  maxDate,
  yearPicker,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `${useId()}-title`;
  const text = FIELD_TEXT[locale];

  // A layout effect, so the dialog is open before DayPicker's own effect moves focus to a day.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Every way out goes through close(), so the native close event is the one place that reports it.
  const closeDialog = (): void => dialogRef.current?.close();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key !== 'Escape') return;
    // Handled here too so Escape works the same where the browser has no dialog support.
    event.preventDefault();
    closeDialog();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>): void => {
    // The dialog has no padding of its own, so a click on the element itself is on the backdrop.
    if (event.target === event.currentTarget) closeDialog();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      lang={DATE_FNS_LOCALES[locale].code}
      onClose={onClosed}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className="m-auto max-w-[calc(100vw-2rem)] rounded-2xl border border-field-border bg-surface-card p-0 text-notice-primary backdrop:bg-shadow-tint/40"
      style={{ boxShadow: DIALOG_SHADOW }}
    >
      {open && (
        <div className="flex flex-col gap-2 p-3">
          <h2 id={titleId} className="px-2 text-body font-bold text-notice-primary">
            {title}
          </h2>
          <DayPicker
            mode="single"
            required
            autoFocus
            selected={selected ?? undefined}
            onSelect={(day) => {
              onPick(day);
              closeDialog();
            }}
            locale={DATE_FNS_LOCALES[locale]}
            weekStartsOn={WEEK_STARTS_ON_MONDAY}
            defaultMonth={initialMonth}
            startMonth={minDate ?? undefined}
            endMonth={maxDate ?? undefined}
            disabled={buildDisabledDays(minDate, maxDate)}
            captionLayout={yearPicker ? 'dropdown' : 'label'}
            classNames={CLASS_NAMES}
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            {onClear && (
              <button
                type="button"
                className={FOOTER_BUTTON}
                onClick={() => {
                  onClear();
                  closeDialog();
                }}
              >
                {text.clear}
              </button>
            )}
            <button
              type="button"
              className={`${FOOTER_BUTTON} border border-field-border`}
              onClick={closeDialog}
            >
              {text.close}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
};
