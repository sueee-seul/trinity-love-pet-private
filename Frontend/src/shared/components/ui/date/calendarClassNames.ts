import {
  DayFlag,
  SelectionState,
  UI,
  getDefaultClassNames,
  type ClassNames,
} from 'react-day-picker';

/*
 * The calendar is styled only with theme utilities; the library stylesheet is not imported, so
 * the `rdp-*` names below carry no styles. They are kept next to ours because the test helpers in
 * testing.ts find the month buttons and dropdowns by them, and those do not change with language.
 */
const OUR_CLASS_NAMES: Partial<ClassNames> = {
  [UI.Root]: 'relative',
  [UI.Months]: 'relative',
  [UI.Month]: 'flex flex-col gap-2',
  [UI.MonthCaption]: 'flex h-11 items-center pl-2 pr-24 text-body font-bold text-notice-primary',
  [UI.CaptionLabel]: 'inline-flex items-center gap-1',
  [UI.Dropdowns]: 'inline-flex items-center gap-2',
  // The library draws a text label next to each dropdown and, in its own stylesheet, lays the
  // select invisibly on top of it. We show the select itself, so the label would repeat the same
  // month and year beside it: hide it.
  [UI.DropdownRoot]: 'relative inline-flex items-center [&>span]:hidden',
  // Our own select look, so the native dropdown shows its value without the library overlay.
  [UI.Dropdown]:
    'h-9 rounded-lg border border-field-border bg-surface-card px-2 text-body text-notice-primary focus:outline-hidden focus:ring-2 focus:ring-focus',
  [UI.Nav]: 'absolute right-0 top-0 flex h-11 items-center gap-1',
  [UI.PreviousMonthButton]:
    'inline-flex h-11 w-11 items-center justify-center rounded-full text-notice-secondary hover:bg-surface-deep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus aria-disabled:opacity-40',
  [UI.NextMonthButton]:
    'inline-flex h-11 w-11 items-center justify-center rounded-full text-notice-secondary hover:bg-surface-deep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus aria-disabled:opacity-40',
  [UI.Chevron]: 'h-4 w-4 fill-current',
  [UI.MonthGrid]: 'border-collapse',
  [UI.Weekday]: 'h-8 w-11 text-meta font-normal text-notice-muted',
  [UI.Day]: 'h-11 w-11 p-0 text-center',
  [UI.DayButton]:
    'inline-flex h-11 w-11 items-center justify-center rounded-full text-body text-notice-primary hover:bg-surface-deep focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-notice-muted disabled:opacity-40 disabled:hover:bg-transparent',
  [DayFlag.today]: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-focus',
  [SelectionState.selected]:
    '[&>button]:bg-action-dark [&>button]:text-on-action-dark [&>button]:hover:bg-action-dark-hover',
  [DayFlag.outside]: 'text-notice-muted',
};

/** Library default names plus our theme utilities, for every calendar part we style. */
export function getCalendarClassNames(): Partial<ClassNames> {
  const defaults = getDefaultClassNames();
  const merged: Partial<ClassNames> = {};
  for (const key of Object.keys(OUR_CLASS_NAMES) as (keyof ClassNames)[]) {
    merged[key] = `${defaults[key]} ${OUR_CLASS_NAMES[key] ?? ''}`;
  }
  return { ...defaults, ...merged };
}
